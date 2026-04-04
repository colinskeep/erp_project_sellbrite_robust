import os
import psycopg2
from fastapi import FastAPI, Depends, Header, HTTPException, Request, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from datetime import datetime
from pydantic import BaseModel
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer, Image
from reportlab.lib import colors
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import getSampleStyleSheet
from reportlab.lib.units import inch
from psycopg2.extras import RealDictCursor
from apscheduler.schedulers.background import BackgroundScheduler
from sellbrite import full_sync, analyze_inventory, sync_inventory_to_sellbrite
from jose import jwt, JWTError

# ================================
# AUTHENTICATION
# ================================


def verify_api_key(request: Request):
    print("🔑 Verifying API key...")
    print("Headers:", request.headers)
    api_key = request.headers.get("x-api-key")
    if api_key != os.getenv("API_KEY"):
        raise HTTPException(status_code=401, detail="Unauthorized")

def get_current_user(authorization: str = Header(...)):
    try:
        token = authorization.split(" ")[1]
        payload = jwt.decode(token, SECRET_KEY, algorithms=["HS256"])
        return payload["sub"]
    except:
        raise HTTPException(status_code=401, detail="Invalid token")

# ================================
# LOGGING
# ================================

import logging

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
)

logger = logging.getLogger(__name__)

# ================================
# DB
# ================================

DATABASE_URL = os.getenv("DATABASE_URL")

def get_db():
    try:
        logger.info("🔌 Opening DB connection (request)")
        conn = psycopg2.connect(DATABASE_URL, cursor_factory=RealDictCursor)
        yield conn
    except Exception:
        logger.exception("❌ DB connection failed")
        raise
    finally:
        conn.close()
        logger.info("🔒 DB connection closed (request)")


def init_db():
    conn = psycopg2.connect(DATABASE_URL)
    cur = conn.cursor()

    cur.execute("""
    CREATE TABLE IF NOT EXISTS purchase_orders (
        id SERIAL PRIMARY KEY,
        supplier TEXT,
        status TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
    """)

    cur.execute("""
    CREATE TABLE IF NOT EXISTS purchase_order_items (
        id SERIAL PRIMARY KEY,
        po_id INTEGER,
        sku TEXT,
        title TEXT,
        quantity INTEGER,
        cost REAL,
        received_quantity INTEGER DEFAULT 0
    )
    """)

    cur.execute("""
    CREATE TABLE IF NOT EXISTS inventory (
        id SERIAL PRIMARY KEY,
        sku TEXT UNIQUE,
        inventory INTEGER
    )
    """)

    cur.execute("""
    CREATE TABLE IF NOT EXISTS products (
        sku TEXT PRIMARY KEY,
        title TEXT,
        brand TEXT,
        last_modified_date TEXT,
        cost REAL
    )
    """)

    cur.execute("""
    CREATE TABLE IF NOT EXISTS sales (
        id SERIAL PRIMARY KEY,
        sku TEXT,
        title TEXT,
        quantity INTEGER,
        price REAL,
        revenue REAL,
        created_at TEXT
    )
    """)

    conn.commit()
    conn.close()


# ================================
# APP INIT
# ================================

app = FastAPI()
init_db()

from fastapi.middleware.cors import CORSMiddleware

origins = [
    "https://erp-project-sellbrite-robust.vercel.app",  # your frontend
    "http://localhost:5173",  # local dev (Vite)
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,   # or ["*"] for testing
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)



# ================================
# SCHEDULER
# ================================

scheduler = BackgroundScheduler()

def run_full_sync():
    logger.info("🔄 Starting scheduled sync...")

    if not DATABASE_URL:
        logger.error("❌ DATABASE_URL is NOT set")
        return

    try:
        logger.info("🔌 Connecting to database...")
        conn = psycopg2.connect(DATABASE_URL)
        logger.info("✅ Database connection successful")

        logger.info("📦 Running full_sync...")
        full_sync(conn)

        logger.info("✅ Sync completed successfully")

        conn.close()
        logger.info("🔒 Database connection closed")

    except Exception as e:
        logger.exception("❌ Sync failed with error")

def start_scheduler():
    scheduler.add_job(run_full_sync, "interval", minutes=15)
    scheduler.start()
    run_full_sync()

@app.on_event("startup")
def startup_event():
    logger.info("🚀 App starting...")
    start_scheduler()


# ================================
# MANUAL SYNC
# ================================

@app.post("/sync")
def manual_sync(conn=Depends(get_db)):
    full_sync(conn)
    return {"status": "sync complete"}


# ================================
# HELPERS
# ================================

def get_on_order_quantities(conn):
    cur = conn.cursor()
    cur.execute("""
        SELECT sku, SUM(quantity - received_quantity) as qty_on_order
        FROM purchase_order_items poi
        JOIN purchase_orders po ON po.id = poi.po_id
        WHERE po.status != 'received'
        GROUP BY sku
    """)
    rows = cur.fetchall()
    return {row["sku"]: row["qty_on_order"] or 0 for row in rows}


# ================================
# LOGIN
# ================================
class LoginRequest(BaseModel):
    email: str
    password: str

@app.post("/login")
def login(data: LoginRequest):
    email = data.email;
    password = data.password;
    conn = get_db()

    user = conn.execute(
        "SELECT * FROM users WHERE email = %s",
        (data.email,)
    ).fetchone()

    if not user or not verify_password(data.password, user["password"]):
        raise HTTPException(status_code=401, detail="Invalid credentials")

    token = create_access_token({"sub": user["email"]})

    return {"access_token": token}


# ================================
# REPLENISHMENT
# ================================

@app.get("/replenishment", dependencies=[Depends(verify_api_key)])
def replenishment(vendor: str = Query(None), user=Depends(get_current_user), conn=Depends(get_db)):
    cur = conn.cursor()

    cur.execute("SELECT * FROM sales")
    sales = cur.fetchall()

    cur.execute("SELECT * FROM products")
    products = cur.fetchall()

    cur.execute("SELECT * FROM inventory")
    inventory = cur.fetchall()

    import pandas as pd

    sales_df = pd.DataFrame(sales)
    product_df = pd.DataFrame(products)
    inventory_df = pd.DataFrame(inventory)

    if sales_df.empty:
        return []

    report_df = analyze_inventory(sales_df, product_df, inventory_df)
    items = report_df.fillna("").to_dict(orient="records")

    po_items = get_on_order_quantities(conn)

    for item in items:
        sku = item.get("sku")

        item["on_order"] = po_items.get(sku, 0)

        item["needed"] = max(
            0,
            item.get("reorder_qty", 0)
            - (item.get("inventory", 0) - item.get("reserved", 0))
            - item["on_order"]
        )

        brand = item.get("brand")
        item["vendor"] = brand.upper() if brand else "UNKNOWN"

    if vendor:
        items = [i for i in items if i["vendor"] == vendor.upper()]

    return items


# ================================
# BASIC DATA ENDPOINTS
# ================================

@app.get("/sales", dependencies=[Depends(verify_api_key)])
def get_sales(user=Depends(get_current_user), conn=Depends(get_db)):
    cur = conn.cursor()
    cur.execute("SELECT * FROM sales")
    return cur.fetchall()

@app.get("/products", dependencies=[Depends(verify_api_key)])
def get_products(user=Depends(get_current_user), conn=Depends(get_db)):
    cur = conn.cursor()
    cur.execute("SELECT * FROM products")
    return cur.fetchall()

@app.get("/inventory", dependencies=[Depends(verify_api_key)])
def get_inventory(user=Depends(get_current_user), conn=Depends(get_db)):
    cur = conn.cursor()
    cur.execute("SELECT * FROM inventory")
    return cur.fetchall()


# ================================
# PURCHASE ORDERS
# ================================

@app.get("/purchase-orders", dependencies=[Depends(verify_api_key)])
def get_purchase_orders(user=Depends(get_current_user), conn=Depends(get_db)):
    cur = conn.cursor()
    cur.execute("SELECT * FROM purchase_orders")
    pos = cur.fetchall()

    results = []

    for po in pos:
        cur.execute("""
            SELECT SUM(quantity * cost) as total
            FROM purchase_order_items
            WHERE po_id=%s
        """, (po["id"],))
        total = cur.fetchone()["total"] or 0

        po["total"] = total
        results.append(po)

    return results


@app.post("/purchase-orders", dependencies=[Depends(verify_api_key)])
async def create_po(request: Request, user=Depends(get_current_user), conn=Depends(get_db)):
    data = await request.json()
    cur = conn.cursor()

    cur.execute(
        "INSERT INTO purchase_orders (supplier, status) VALUES (%s, %s) RETURNING id",
        (data.get("supplier", "UNKNOWN"), "draft")
    )
    po_id = cur.fetchone()["id"]

    for item in data.get("items", []):
        cur.execute("""
            INSERT INTO purchase_order_items (po_id, sku, title, quantity, cost)
            VALUES (%s, %s, %s, %s, %s)
        """, (
            po_id,
            item.get("sku"),
            item.get("title", ""),
            item.get("quantity", 0),
            item.get("cost", 0)
        ))

    conn.commit()
    return {"success": True, "po_id": po_id}


@app.get("/purchase-orders/{po_id}", dependencies=[Depends(verify_api_key)])
def get_po_detail(po_id: int, user=Depends(get_current_user), conn=Depends(get_db)):
    cur = conn.cursor()

    cur.execute("SELECT * FROM purchase_orders WHERE id=%s", (po_id,))
    po = cur.fetchone()

    if not po:
        return {"error": "PO not found"}

    cur.execute("""
        SELECT * FROM purchase_order_items WHERE po_id=%s
    """, (po_id,))
    items = cur.fetchall()

    po["items"] = items
    return po


# ================================
# PO ITEMS
# ================================

class POItemUpdate(BaseModel):
    quantity: int

@app.put("/purchase-orders/{po_id}/items/{sku}", dependencies=[Depends(verify_api_key)])
def update_po_item(po_id: int, sku: str, data: POItemUpdate, user=Depends(get_current_user), conn=Depends(get_db)):
    cur = conn.cursor()
    cur.execute(
        "UPDATE purchase_order_items SET quantity=%s WHERE po_id=%s AND sku=%s",
        (data.quantity, po_id, sku),
    )
    conn.commit()
    return {"success": True}


@app.delete("/purchase-orders/{po_id}/items/{sku}", dependencies=[Depends(verify_api_key)])
def delete_po_item(po_id: int, sku: str, user=Depends(get_current_user), conn=Depends(get_db)):
    cur = conn.cursor()
    cur.execute(
        "DELETE FROM purchase_order_items WHERE po_id=%s AND sku=%s",
        (po_id, sku)
    )
    conn.commit()
    return {"success": True}


@app.post("/purchase-orders/{po_id}/items", dependencies=[Depends(verify_api_key)])
def add_po_item(po_id: int, item: dict, user=Depends(get_current_user), conn=Depends(get_db)):
    cur = conn.cursor()
    cur.execute("""
        INSERT INTO purchase_order_items (po_id, sku, title, quantity, cost, received_quantity)
        VALUES (%s, %s, %s, %s, %s, 0)
    """, (
        po_id,
        item["sku"],
        item.get("title", ""),
        item.get("quantity", 1),
        item.get("cost", 0),
    ))
    conn.commit()
    return {"success": True}


# ================================
# SEARCH
# ================================

@app.get("/products/search", dependencies=[Depends(verify_api_key)])
def search_products(q: str, user=Depends(get_current_user), conn=Depends(get_db)):
    cur = conn.cursor()
    cur.execute("""
        SELECT sku, title, cost
        FROM products
        WHERE sku ILIKE %s OR title ILIKE %s
        LIMIT 20
    """, (f"%{q}%", f"%{q}%"))
    return cur.fetchall()


# ================================
# PO ACTIONS
# ================================

@app.delete("/purchase-orders/{po_id}", dependencies=[Depends(verify_api_key)])
def delete_po(po_id: int, user=Depends(get_current_user), conn=Depends(get_db)):
    cur = conn.cursor()
    cur.execute("DELETE FROM purchase_orders WHERE id=%s", (po_id,))
    conn.commit()
    return {"success": True}


@app.post("/purchase-orders/{po_id}/submit", dependencies=[Depends(verify_api_key)])
def submit_po(po_id: int, user=Depends(get_current_user), conn=Depends(get_db)):
    cur = conn.cursor()
    cur.execute("UPDATE purchase_orders SET status='submitted' WHERE id=%s", (po_id,))
    conn.commit()
    return {"success": True}


@app.post("/purchase-orders/{po_id}/revert", dependencies=[Depends(verify_api_key)])
def revert_po(po_id: int, user=Depends(get_current_user), conn=Depends(get_db)):
    cur = conn.cursor()
    cur.execute("UPDATE purchase_orders SET status='draft' WHERE id=%s", (po_id,))
    conn.commit()
    return {"success": True}


# ================================
# RECEIVE FULL PO
# ================================

@app.post("/purchase-orders/{po_id}/receive", dependencies=[Depends(verify_api_key)])
def receive_po(po_id: int, user=Depends(get_current_user), conn=Depends(get_db)):
    cur = conn.cursor()

    cur.execute("UPDATE purchase_orders SET status='received' WHERE id=%s", (po_id,))

    cur.execute("SELECT sku, quantity FROM purchase_order_items WHERE po_id=%s", (po_id,))
    items = cur.fetchall()

    for item in items:
        sku = item["sku"]
        qty = item["quantity"]

        cur.execute("SELECT * FROM inventory WHERE sku=%s", (sku,))
        row = cur.fetchone()

        if row:
            cur.execute(
                "UPDATE inventory SET inventory = inventory + %s WHERE sku=%s",
                (qty, sku)
            )
        else:
            cur.execute(
                "INSERT INTO inventory (sku, inventory) VALUES (%s, %s)",
                (sku, qty)
            )

    conn.commit()
    return {"success": True}

@app.get("/purchase-orders/{po_id}/download")
def download_po(po_id: int, user=Depends(get_current_user), conn=Depends(get_db)):
    
    cur = conn.cursor()
    cur.execute(
        "SELECT * FROM purchase_orders WHERE id=%s",
        (po_id,)
    )
    po_row = cur.fetchone()

    if not po_row:
        return {"detail": "Not Found"}

    po = dict(po_row)

    cur.execute(
        "SELECT * FROM purchase_order_items WHERE po_id=%s",
        (po_id,)
    )
    item_rows = cur.fetchall()

    items = [dict(r) for r in item_rows]

    file_path = f"po_{po_id}.pdf"

    doc = SimpleDocTemplate(
        file_path,
        pagesize=letter,
        rightMargin=40,
        leftMargin=40,
        topMargin=40,
        bottomMargin=40
    )

    styles = getSampleStyleSheet()
    elements = []

    # =======================
    # 🧾 HEADER (LOGO + INFO)
    # =======================

    logo_path = "assets/logo.png"

    header_data = []

    if os.path.exists(logo_path):
        logo = Image(logo_path, width=2.5 * inch, height=0.8 * inch)
        header_data.append([
            logo,
            Paragraph(
                "<b>Arizona Fine Time</b><br/>"
                "Scottsdale, AZ<br/>"
                "www.azfinetime.com",
                styles["Normal"]
            )
        ])
    else:
        header_data.append([
            "",
            Paragraph(
                "<b>Arizona Fine Time</b><br/>"
                "Scottsdale, AZ<br/>"
                "www.azfinetime.com",
                styles["Normal"]
            )
        ])

    header_table = Table(header_data, colWidths=[250, 250])
    elements.append(header_table)

    elements.append(Spacer(1, 20))

    # =======================
    # 📦 PO + SUPPLIER BLOCK
    # =======================

    info_data = [
        ["PO Number:", f"#{po['id']}"],
        ["Supplier:", po["supplier"]],
        ["Status:", po["status"]],
        ["Created:", po["created_at"]],
    ]

    info_table = Table(info_data, colWidths=[120, 300])
    info_table.setStyle(TableStyle([
        ("FONTNAME", (0, 0), (0, -1), "Helvetica-Bold"),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
    ]))

    elements.append(info_table)
    elements.append(Spacer(1, 20))

    # =======================
    # 📊 ITEMS TABLE
    # =======================

    data = [["SKU", "Product", "Qty", "Unit Cost", "Total"]]
    total_cost = 0

    for item in items:
        qty = item["quantity"]
        cost = item.get("cost", 0) or 0
        line_total = qty * cost
        total_cost += line_total

        data.append([
            item["sku"],
            item["title"][:30],
            str(qty),
            f"${cost:.2f}",
            f"${line_total:.2f}"
        ])

    table = Table(data, colWidths=[90, 200, 50, 80, 80])

    table.setStyle(TableStyle([
        # Header
        ("BACKGROUND", (0, 0), (-1, 0), colors.black),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),

        # Body
        ("GRID", (0, 0), (-1, -1), 0.25, colors.grey),
        ("ALIGN", (2, 1), (-1, -1), "RIGHT"),

        # Padding
        ("TOPPADDING", (0, 0), (-1, -1), 6),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
    ]))

    elements.append(table)

    elements.append(Spacer(1, 20))

    # =======================
    # 💰 TOTAL SECTION
    # =======================

    total_table = Table([
        ["", "TOTAL:", f"${total_cost:.2f}"]
    ], colWidths=[300, 100, 100])

    total_table.setStyle(TableStyle([
        ("FONTNAME", (1, 0), (-1, -1), "Helvetica-Bold"),
        ("ALIGN", (1, 0), (-1, -1), "RIGHT"),
        ("LINEABOVE", (1, 0), (-1, 0), 1, colors.black),
        ("TOPPADDING", (0, 0), (-1, -1), 10),
    ]))

    elements.append(total_table)

    elements.append(Spacer(1, 30))

    # =======================
    # 📝 FOOTER / TERMS
    # =======================

    elements.append(Paragraph("<b>Terms & Notes</b>", styles["Heading3"]))
    elements.append(Spacer(1, 6))

    elements.append(Paragraph(
        "Please confirm receipt of this purchase order. "
        "All items subject to availability. "
        "Contact us with any discrepancies.",
        styles["Normal"]
    ))

    elements.append(Spacer(1, 20))

    elements.append(Paragraph(
        "Authorized Signature: ___________________________",
        styles["Normal"]
    ))

    # Build PDF
    doc.build(elements)

    return FileResponse(file_path, filename=f"PO_{po_id}.pdf", media_type="application/pdf")

class ReceiveItemRequest(BaseModel):
    quantity: int

@app.post("/purchase-orders/{po_id}/items/{sku}/receive", dependencies=[Depends(verify_api_key)])
def receive_po_item(po_id: int, sku: str, payload: ReceiveItemRequest, user=Depends(get_current_user), conn=Depends(get_db)):
    quantity = payload.quantity
    cur = conn.cursor()

    # ✅ Get item
    cur.execute(
        "SELECT * FROM purchase_order_items WHERE po_id=%s AND sku=%s",
        (po_id, sku)
    )
    item = cur.fetchone()

    if not item:
        raise HTTPException(status_code=404, detail="Item not found")

    remaining = item["quantity"] - item["received_quantity"]

    if quantity <= 0:
        raise HTTPException(status_code=400, detail="Invalid quantity")

    if quantity > remaining:
        raise HTTPException(status_code=400, detail="Receiving more than remaining")

    # ✅ Update received quantity
    cur.execute(
        """
        UPDATE purchase_order_items
        SET received_quantity = received_quantity + %s
        WHERE po_id=%s AND sku=%s
        """,
        (quantity, po_id, sku)
    )

    # ✅ Update inventory
    cur.execute(
        "SELECT * FROM inventory WHERE sku=%s",
        (sku,)
    )
    inv = cur.fetchone()

    if inv:
        cur.execute(
            "UPDATE inventory SET inventory = inventory + %s WHERE sku=%s",
            (quantity, sku)
        )
    else:
        cur.execute(
            "INSERT INTO inventory (sku, inventory) VALUES (%s, %s)",
            (sku, quantity)
        )

    conn.commit()

    # 🚀 Push to Sellbrite
    sync_inventory_to_sellbrite(conn, sku)

    # 🔄 Check if PO complete
    cur.execute("""
        SELECT COUNT(*) as count
        FROM purchase_order_items
        WHERE po_id=%s AND quantity > received_quantity
    """, (po_id,))
    remaining_items = cur.fetchone()

    if remaining_items["count"] == 0:
        cur.execute(
            "UPDATE purchase_orders SET status='received' WHERE id=%s",
            (po_id,)
        )
        conn.commit()

    # 🔄 Return updated PO
    cur.execute("SELECT * FROM purchase_orders WHERE id=%s", (po_id,))
    po = cur.fetchone()

    cur.execute("SELECT * FROM purchase_order_items WHERE po_id=%s", (po_id,))
    items = cur.fetchall()

    po["items"] = items

    return po
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from datetime import datetime
from fastapi import Request
from pydantic import BaseModel
from fastapi import Query
from fastapi import Depends
from pydantic import BaseModel
from fastapi.responses import StreamingResponse
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer, Image
from reportlab.lib import colors
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import getSampleStyleSheet
from reportlab.lib.units import inch
from sellbrite import sync_inventory_to_sellbrite
from fastapi import HTTPException

import io
import os
import sqlite3

class UpdateQuantity(BaseModel):
    quantity: int

import sqlite3

def get_db():
    conn = sqlite3.connect("erp.db")
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = get_db()
    cur = conn.cursor()

    cur.execute("""
    CREATE TABLE IF NOT EXISTS purchase_orders (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        supplier TEXT,
        status TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
    """)

    cur.execute("""
    CREATE TABLE IF NOT EXISTS purchase_order_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        po_id INTEGER,
        sku TEXT,
        title TEXT,
        quantity INTEGER,
        cost REAL
    )
    """)
    cur.execute("""
    CREATE TABLE IF NOT EXISTS inventory (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        sku TEXT UNIQUE,
        inventory INTEGER
    )
    """)

    cur.execute("""
    CREATE TABLE IF NOT EXISTS products (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        sku TEXT UNIQUE,
        title TEXT
    )
    """)

    rows = cur.fetchall()

    return {sku: qty for sku, qty in rows}

    conn.commit()
    conn.close()

app = FastAPI()

init_db()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Allow frontend origin
origins = [
    "http://localhost:5173"
]



from sellbrite import (
    get_orders,
    get_products,
    get_inventory,
    build_sales_dataframe,
    build_product_dataframe,
    build_inventory_dataframe,
    analyze_inventory
)
import time

cache = {"data": None, "timestamp": 0}
CACHE_SECONDS = 900  # 5 min

from fastapi import Query

def extract_vendor(title: str):
    if not title:
        return "UNKNOWN"
    return title.split(" ")[0].upper()

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

    return {sku: qty for sku, qty in rows}

def get_inventory_logic():
    data = fetch_all_sellbrite_inventory()  # you already have this

    items = []

    for item in data:
        sku = item.get("sku")
        title = item.get("name") or item.get("title", "")
        cost = item.get("cost", 0)

        # 🚫 skip bad SKUs
        if not sku or sku.strip() == "":
            continue

        available = item.get("available_quantity", 0)

        # 👉 simple reorder logic (adjust later)

        items.append({
            "sku": sku,
            "title": title,
            "vendor": extract_vendor(title),
            "available": available,
            "reorder_point": reorder_point,
            "cost": cost
        })

    return items

@app.get("/replenishment")
def replenishment(vendor: str = Query(None)):
    """
    Returns a cached replenishment report, enriched with:
      - vendor
      - on_order quantities
      - needed quantities (reorder point minus on-hand minus on-order)
    Optional filtering by vendor.
    """

    now = time.time()
    if cache["data"] and now - cache["timestamp"] < CACHE_SECONDS:
        items = cache["data"]
    else:
        print("Fetching data from Sellbrite API...")
        # Fetch Sellbrite data
        orders = get_orders()
        products = get_products()
        inventory = get_inventory()

        sales_df = build_sales_dataframe(orders)
        product_df = build_product_dataframe(products)
        inventory_df = build_inventory_dataframe(inventory)
        report_df = analyze_inventory(sales_df, product_df, inventory_df)

        # Insert products into local DB

        conn = get_db()

        for product in inventory:
            sku = product.get("sku")
            title = product.get("product_name") or product.get("title", "")
            cost = product.get("cost", 0)

            if not sku:
                continue

            existing = conn.execute(
                "SELECT sku FROM products WHERE sku=?",
                (sku,)
            ).fetchone()

            if existing:
                conn.execute(
                    """
                    UPDATE products
                    SET title=?, cost=?
                    WHERE sku=?
                    """,
                    (title, cost, sku)
                )
            else:
                conn.execute(
                    """
                    INSERT INTO products (sku, title, cost)
                    VALUES (?, ?, ?)
                    """,
                    (sku, title, cost)
                )

        conn.commit()
        conn.close()

        # Convert to records for JSON
        items = report_df.fillna(0).to_dict(orient="records")

        # Build on_order lookup (from existing purchase orders)
        conn = get_db()
        po_items = get_on_order_quantities(conn)  # returns {sku: qty_on_order}

        # Update inventory quantites for each item

        for _, row in report_df.iterrows():
            sku = row["sku"]
            current_inventory = row["inventory"]

            existing = conn.execute(
                "SELECT * FROM inventory WHERE sku=?",
                (sku,)
            ).fetchone()

            if existing:
                conn.execute(
                    "UPDATE inventory SET inventory=? WHERE sku=?",
                    (current_inventory, sku)
                )
            else:
                conn.execute(
                    "INSERT INTO inventory (sku, inventory) VALUES (?, ?)",
                    (sku, current_inventory)
                )
        conn.commit()

        # Cache it
        cache["data"] = items
        cache["timestamp"] = now

    
    conn = get_db()
    po_items = get_on_order_quantities(conn)  # returns {sku: qty_on_order}

    for item in items:
        sku = item.get("sku")
        item["on_order"] = po_items.get(sku, 0)
        cost = item.get("cost", 0)

        # Compute needed quantity
        print(item)
        item["needed"] = max(
            0,
            (item.get("reorder_qty", 0)) - (item.get("inventory", 0) - item.get("reserved", 0)) - item["on_order"]
        )

        # Extract vendor from title if missing
        if not item.get("vendor"):
            #title = item.get("title", "")
            #item["vendor"] = title.split(" ")[0].upper() if title else "UNKNOWN"
            item["vendor"] = item.get("brand", "UNKNOWN").upper() if item.get("brand") else "UNKNOWN"

    # Filter by vendor if provided
    if vendor:
        items = [i for i in items if i["vendor"] == vendor.upper()]

    return items

@app.get("/purchase-orders")
def get_purchase_orders(conn=Depends(get_db)):
    pos = conn.execute("SELECT * FROM purchase_orders").fetchall()

    results = []

    for po in pos:
        po = dict(po)

        total = conn.execute(
            """
            SELECT SUM(quantity * cost) as total
            FROM purchase_order_items
            WHERE po_id=?
            """,
            (po["id"],)
        ).fetchone()

        po["total"] = total["total"] or 0

        results.append(po)

    return results

@app.post("/purchase-orders")
async def create_po(request: Request):
    try:
        data = await request.json()

        conn = get_db()
        cur = conn.cursor()

        cur.execute(
            "INSERT INTO purchase_orders (supplier, status) VALUES (?, ?)",
            (data.get("supplier", "UNKNOWN"), "draft")
        )

        po_id = cur.lastrowid

        for item in data.get("items", []):
            cur.execute(
                "INSERT INTO purchase_order_items (po_id, sku, title, quantity, cost) VALUES (?, ?, ?, ?, ?)",
                (
                    po_id,
                    item.get("sku"),
                    item.get("title", ""),
                    item.get("quantity", 0),
                    item.get("cost",0)
                )
            )

        conn.commit()
        conn.close()

        return {"success": True, "po_id": po_id}

    except Exception as e:
        print("ERROR:", str(e))
        return {"error": str(e)}

@app.get("/purchase-orders/{po_id}")
def get_po_detail(po_id: int):
    conn = get_db()
    cur = conn.cursor()

    # Get PO
    cur.execute("SELECT * FROM purchase_orders WHERE id = ?", (po_id,))
    po = cur.fetchone()

    if not po:
        conn.close()
        return {"error": "PO not found"}

    # Get items
    cur.execute("""
        SELECT id, sku, title, quantity, cost, received_quantity
        FROM purchase_order_items
        WHERE po_id = ?
    """, (po_id,))
    items = cur.fetchall()

    conn.close()
    
    return {
        "id": po[0],
        "supplier": po[1],
        "status": po[2],
        "created_at": po[3],
        "items": [
            {
                "id": i[0],
                "sku": i[1],
                "title": i[2],
                "quantity": i[3],
                "cost": i[4],
                "received_quantity": i[5]
            }
            for i in items
        ]
    }
from fastapi import Path

class POItemUpdate(BaseModel):
    quantity: int

@app.put("/purchase-orders/{po_id}/items/{sku}")

def update_po_item(po_id: int, sku: str, data: POItemUpdate, conn=Depends(get_db)):
    conn.execute(
        "UPDATE purchase_order_items SET quantity=? WHERE po_id=? AND sku=?",
        (data.quantity, po_id, sku),
    )
    conn.commit()
    return {"success": True}

@app.delete("/purchase-orders/{po_id}/items/{sku}")
def delete_po_item(po_id: int, sku: str, conn=Depends(get_db)):
    conn.execute(
        "DELETE FROM purchase_order_items WHERE po_id=? AND sku=?",
        (po_id, sku)
    )
    conn.commit()

    return {"success": True}

@app.post("/purchase-orders/{po_id}/items")
def add_po_item(po_id: int, item: dict, conn=Depends(get_db)):
    conn.execute(
        """
        INSERT INTO purchase_order_items (po_id, sku, title, quantity, cost, received_quantity)
        VALUES (?, ?, ?, ?, ?, 0)
        """,
        (
            po_id,
            item["sku"],
            item["title"],
            item.get("quantity", 1),
            item.get("cost", 0),
        )
    )
    conn.commit()

    return {"success": True}

@app.get("/products/search")
def search_products(q: str, conn=Depends(get_db)):
    rows = conn.execute(
        """
        SELECT sku, title, cost
        FROM products
        WHERE sku LIKE ? OR title LIKE ?
        LIMIT 20
        """,
        (f"%{q}%", f"%{q}%")
    ).fetchall()

    return [dict(r) for r in rows]

@app.delete("/purchase-orders/{po_id}")
def delete_po(po_id: int, conn=Depends(get_db)):
    conn.execute("DELETE FROM purchase_orders WHERE id=?", (po_id,))
    conn.commit()
    return {"success": True}

@app.post("/purchase-orders/{po_id}/submit")
def submit_po(po_id: int, conn=Depends(get_db)):
    # Mark PO as submitted
    conn.execute("UPDATE purchase_orders SET status='submitted' WHERE id=?", (po_id,))
    conn.commit()
    return {"success": True}

@app.post("/purchase-orders/{po_id}/revert")
def revert_po(po_id: int, conn=Depends(get_db)):
    conn.execute(
        "UPDATE purchase_orders SET status='draft' WHERE id=?",
        (po_id,)
    )
    conn.commit()
    return {"success": True}


@app.post("/purchase-orders/{po_id}/receive")
def receive_po(po_id: int):
    """
    Mark the PO as received and add items to inventory
    """
    conn = get_db()
    cur = conn.cursor()

    # Update PO status
    cur.execute(
        "UPDATE purchase_orders SET status = 'received' WHERE id = ?",
        (po_id,)
    )

    # Add quantities to inventory
    cur.execute("SELECT id, sku, quantity FROM purchase_order_items WHERE po_id = ?", (po_id,))
    items = cur.fetchall()

    for item_id, sku, qty in items:
        # Check if SKU exists in inventory
        cur.execute("SELECT inventory FROM inventory WHERE sku = ?", (sku,))
        row = cur.fetchone()
        if row:
            cur.execute(
                "UPDATE inventory SET inventory = inventory + ? WHERE sku = ?",
                (qty, sku)
            )
        else:
            cur.execute(
                "INSERT INTO inventory (sku, inventory) VALUES (?, ?)",
                (sku, qty)
            )



    conn.commit()
    conn.close()


    return {"success": True}

@app.get("/purchase-orders/{po_id}/download")
def download_po(po_id: int, conn=Depends(get_db)):
    po_row = conn.execute(
        "SELECT * FROM purchase_orders WHERE id=?",
        (po_id,)
    ).fetchone()

    if not po_row:
        return {"detail": "Not Found"}

    po = dict(po_row)

    item_rows = conn.execute(
        "SELECT * FROM purchase_order_items WHERE po_id=?",
        (po_id,)
    ).fetchall()

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

@app.post("/purchase-orders/{po_id}/items/{sku}/receive")
def receive_po_item(po_id: int, sku: str, payload: ReceiveItemRequest, conn=Depends(get_db)):
    quantity = payload.quantity

    item = conn.execute(
        "SELECT * FROM purchase_order_items WHERE po_id=? AND sku=?",
        (po_id, sku)
    ).fetchone()

    if not item:
        raise HTTPException(status_code=404, detail="Item not found")

    item = dict(item)
    remaining = item["quantity"] - item["received_quantity"]

    if quantity <= 0:
        raise HTTPException(status_code=400, detail="Invalid quantity")

    if quantity > remaining:
        raise HTTPException(status_code=400, detail="Receiving more than remaining")

    # ✅ Update received quantity
    conn.execute(
        """
        UPDATE purchase_order_items
        SET received_quantity = received_quantity + ?
        WHERE po_id=? AND sku=?
        """,
        (quantity, po_id, sku)
    )

    # ✅ Update local inventory
    inv = conn.execute(
        "SELECT * FROM inventory WHERE sku=?",
        (sku,)
    ).fetchone()

    if inv:
        conn.execute(
            """
            UPDATE inventory
            SET inventory = inventory + ?
            WHERE sku=?
            """,
            (quantity, sku)
        )
    else:
        conn.execute(
            """
            INSERT INTO inventory (sku, inventory)
            VALUES (?, ?)
            """,
            (sku, quantity)
        )

    conn.commit()

    # 🚀 Push update to Sellbrite
    sync_inventory_to_sellbrite(conn, sku)

    # 🔄 Auto-close PO if fully received
    remaining_items = conn.execute(
        """
        SELECT COUNT(*) as count
        FROM purchase_order_items
        WHERE po_id=? AND quantity > received_quantity
        """,
        (po_id,)
    ).fetchone()

    if remaining_items["count"] == 0:
        conn.execute(
            "UPDATE purchase_orders SET status='received' WHERE id=?",
            (po_id,)
        )
        conn.commit()

    # 🔄 Return updated PO and items for frontend
    po = conn.execute(
        "SELECT * FROM purchase_orders WHERE id=?",
        (po_id,)
    ).fetchone()
    items = conn.execute(
        "SELECT * FROM purchase_order_items WHERE po_id=?",
        (po_id,)
    ).fetchall()

    po_dict = dict(po)
    po_dict["items"] = [dict(i) for i in items]

    return po_dict
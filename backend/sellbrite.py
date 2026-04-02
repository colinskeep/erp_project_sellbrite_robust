import requests
import pandas as pd
import datetime
import os
from dotenv import load_dotenv
import numpy as np
import logging

load_dotenv()

# ================================
# 🧾 LOGGING
# ================================
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger(__name__)

API_TOKEN = os.getenv("SELLBRITE_API_TOKEN")
BASE_URL = "https://api.sellbrite.com/v1"

HEADERS = {
    "Authorization": f"Basic {API_TOKEN}",
    "Content-Type": "application/json"
}

TIMEOUT = 30  # 🚨 prevents hanging


# ================================
# 🔄 PUSH INVENTORY TO SELLBRITE
# ================================

def sync_inventory_to_sellbrite(conn, sku):
    logger.info(f"🔄 Syncing inventory for {sku}")

    cur = conn.cursor()
    cur.execute("SELECT * FROM inventory WHERE sku=%s", (sku,))
    inv = cur.fetchone()

    if not inv:
        logger.warning(f"⚠️ No inventory found for {sku}")
        return

    payload = {
        "inventory": {
            "sku": sku,
            "on_hand": inv["inventory"],
            "warehouse_uuid": "eb41dbba-1283-4175-af5c-9da8a464deec"
        }
    }

    try:
        r = requests.put(
            f"{BASE_URL}/inventory/",
            headers=HEADERS,
            json=payload,
            timeout=TIMEOUT
        )

        if r.status_code not in [200, 204]:
            logger.error(f"❌ Sellbrite sync failed for {sku}: {r.text}")
        else:
            logger.info(f"✅ Synced {sku} → {inv['inventory']}")

    except Exception:
        logger.exception(f"❌ Error syncing {sku}")


# ================================
# 📦 API FETCHERS
# ================================

def get_orders():
    logger.info("📦 Fetching orders...")

    start_date = (datetime.datetime.now(datetime.timezone.utc) - datetime.timedelta(days=90)).isoformat()
    orders = []
    page = 1

    while True:
        logger.info(f"➡️ Orders page {page}")

        try:
            r = requests.get(
                f"{BASE_URL}/orders",
                headers=HEADERS,
                params={
                    "created_at_min": start_date,
                    "page": page,
                    "limit": 100
                },
                timeout=TIMEOUT
            )
        except Exception:
            logger.exception("❌ Orders request failed")
            break

        if r.status_code == 403:
            logger.warning(f"⛔ Orders stopped at page {page} (403)")
            break

        r.raise_for_status()
        batch = r.json()

        if not batch:
            break

        orders.extend(batch)

        logger.info(f"✅ Pulled {len(batch)} orders")

        if len(batch) < 100:
            break

        page += 1

    logger.info(f"📦 Total orders: {len(orders)}")
    return orders


def get_products():
    logger.info("📦 Fetching products...")

    products = []
    page = 1

    while True:
        logger.info(f"➡️ Products page {page}")

        try:
            r = requests.get(
                f"{BASE_URL}/products",
                headers=HEADERS,
                params={"page": page, "limit": 100},
                timeout=TIMEOUT
            )
        except Exception:
            logger.exception("❌ Products request failed")
            break

        if r.status_code == 403:
            logger.warning(f"⛔ Products stopped at page {page}")
            break

        r.raise_for_status()
        batch = r.json()

        if not batch:
            break

        products.extend(batch)
        logger.info(f"✅ Pulled {len(batch)} products")

        if len(batch) < 100:
            break

        page += 1

    logger.info(f"📦 Total products: {len(products)}")
    return products


def get_inventory():
    logger.info("📦 Fetching inventory...")

    inventory = []
    page = 1

    while True:
        logger.info(f"➡️ Inventory page {page}")

        try:
            r = requests.get(
                f"{BASE_URL}/inventory",
                headers=HEADERS,
                params={"page": page, "limit": 100},
                timeout=TIMEOUT
            )
        except Exception:
            logger.exception("❌ Inventory request failed")
            break

        if r.status_code == 403:
            logger.warning(f"⛔ Inventory stopped at page {page}")
            break

        r.raise_for_status()
        batch = r.json()

        if not batch:
            break

        inventory.extend(batch)
        logger.info(f"✅ Pulled {len(batch)} inventory records")

        if len(batch) < 100:
            break

        page += 1

    logger.info(f"📦 Total inventory: {len(inventory)}")
    return inventory


# ================================
# 🧠 DATA BUILDERS (unchanged)
# ================================

def build_sales_dataframe(orders):
    rows = []

    for order in orders:
        items = order.get("order_items") or order.get("items") or []

        for item in items:
            rows.append({
                "sku": item.get("sku"),
                "title": item.get("title") or item.get("name"),
                "quantity": item.get("quantity", 0),
                "price": float(item.get("unit_price", 0)),
                "created_at": order["ordered_at"],
            })

    df = pd.DataFrame(rows)

    if df.empty:
        return df

    df["revenue"] = df["quantity"] * df["price"]
    return df


def build_product_dataframe(products, inventory_df):
    rows = []

    cost_lookup = {}
    if not inventory_df.empty:
        cost_lookup = dict(zip(inventory_df["sku"], inventory_df["cost"]))

    for p in products:
        sku = p.get("sku")

        rows.append({
            "sku": sku,
            "title": p.get("name") or p.get("title"),
            "last_modified_date": p.get("modified_at"),
            "brand": p.get("brand"),
            "cost": cost_lookup.get(sku, 0)
        })

    return pd.DataFrame(rows)


def build_inventory_dataframe(inventory):
    rows = []

    for item in inventory:
        rows.append({
            "sku": item.get("sku"),
            "title": item.get("name") or item.get("title"),
            "inventory": item.get("on_hand", 0),
            "reserved": item.get("reserved", 0),
            "cost": item.get("cost", 0)
        })

    return pd.DataFrame(rows)


# ================================
# 💾 SAVE TO DB (with logging)
# ================================

def save_sales_to_db(conn, df):
    logger.info("💾 Saving sales to DB...")
    cur = conn.cursor()

    cur.execute("DELETE FROM sales")

    for _, row in df.iterrows():
        cur.execute("""
            INSERT INTO sales (sku, title, quantity, price, revenue, created_at)
            VALUES (%s, %s, %s, %s, %s, %s)
        """, (
            row.get("sku"),
            row.get("title"),
            int(row.get("quantity", 0)),
            float(row.get("price", 0)),
            float(row.get("revenue", 0)),
            str(row.get("created_at"))
        ))

    conn.commit()
    logger.info("✅ Sales saved")


def save_products_to_db(conn, df):
    logger.info("💾 Saving products...")
    cur = conn.cursor()

    cur.execute("DELETE FROM products")

    for _, row in df.iterrows():
        cur.execute("""
            INSERT INTO products (sku, title, brand, last_modified_date, cost)
            VALUES (%s, %s, %s, %s, %s)
        """, (
            row.get("sku"),
            row.get("title"),
            row.get("brand"),
            row.get("last_modified_date"),
            row.get("cost")
        ))

    conn.commit()
    logger.info("✅ Products saved")


def save_inventory_to_db(conn, df):
    logger.info("💾 Saving inventory...")
    cur = conn.cursor()

    cur.execute("DELETE FROM inventory")

    for _, row in df.iterrows():
        cur.execute("""
            INSERT INTO inventory (sku, inventory)
            VALUES (%s, %s)
        """, (
            row.get("sku"),
            int(row.get("inventory", 0))
        ))

    conn.commit()
    logger.info("✅ Inventory saved")

#=========
#ANALYTICS
#=========
def analyze_inventory(sales_df, product_df, inventory_df):
    sales_df["created_at"] = pd.to_datetime(sales_df["created_at"], errors="coerce")
    sales_df = sales_df.dropna(subset=["created_at"])

    if sales_df["created_at"].dt.tz is None:
        sales_df["created_at"] = sales_df["created_at"].dt.tz_localize('UTC')

    today = pd.Timestamp.now(tz='UTC')

    first_sale_df = sales_df.groupby("sku").agg(
        first_sale_date=("created_at", "min")
    ).reset_index()

    first_sale_df["days_active"] = (today - first_sale_df["first_sale_date"]).dt.days.clip(lower=7)

    sales_summary = sales_df.groupby("sku").agg(
        sold_qty=("quantity", "sum"),
        revenue=("revenue", "sum")
    ).reset_index()

    df = sales_summary.merge(product_df, on="sku", how="left")
    df = df.merge(inventory_df, on="sku", how="left")

    df["inventory"] = df["inventory"].fillna(0)
    df["cost"] = df["cost"].fillna(0)

    df = df.merge(first_sale_df[["sku", "days_active"]], on="sku", how="left")

    df["daily_sales"] = df["sold_qty"] / df["days_active"]
    df["days_of_stock"] = np.where(df["daily_sales"] > 0, df["inventory"] / df["daily_sales"], np.nan)
    df["reorder_point"] = np.ceil(df["daily_sales"] * 30)
    df["reorder_qty"] = (df["reorder_point"] - df["inventory"]).clip(lower=0)
    df["stockout_date"] = today + pd.to_timedelta(df["days_of_stock"].fillna(9999), unit="D")

    return df.sort_values("reorder_qty", ascending=False)



# ================================
# 🔄 FULL SYNC
# ================================

def full_sync(conn):
    logger.info("🚀 Starting FULL Sellbrite sync")

    orders = get_orders()
    products = get_products()
    inventory = get_inventory()

    logger.info("📊 Building dataframes...")
    sales_df = build_sales_dataframe(orders)
    inventory_df = build_inventory_dataframe(inventory)
    product_df = build_product_dataframe(products, inventory_df)

    logger.info("💾 Writing to database...")
    save_sales_to_db(conn, sales_df)
    save_products_to_db(conn, product_df)
    save_inventory_to_db(conn, inventory_df)

    logger.info("🎉 FULL SYNC COMPLETE")
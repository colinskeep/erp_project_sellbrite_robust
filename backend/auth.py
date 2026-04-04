from datetime import datetime, timedelta
from jose import jwt
from passlib.context import CryptContext
import os

SECRET_KEY = os.getenv("SECRET_KEY", "devsecret")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 8

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


# 🔒 Normalize password safely (handles unicode + length)
def normalize_password(password: str) -> bytes:
    if isinstance(password, str):
        password = password.encode("utf-8")
    return password[:72]


def hash_password(password: str):
    password = normalize_password(password)
    return pwd_context.hash(password)


def verify_password(plain, hashed):
    try:
        plain = normalize_password(plain)
        return pwd_context.verify(plain, hashed)
    except ValueError:
        # 🚨 fallback safety (prevents crashes on edge cases)
        return False


def create_access_token(data: dict):
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
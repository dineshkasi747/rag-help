"""
JWT authentication utilities.

Design decisions:
- HS256 over RS256: simpler for single-service deployment; RS256 is better for
  multi-service (can verify without the private key). Swap by changing algorithm + key loading.
- Access + refresh token pattern: short-lived access tokens (default 24h) + long-lived
  refresh tokens stored in an httpOnly cookie reduce XSS risk.
- passlib[bcrypt] for password hashing: bcrypt auto-handles salting and is intentionally slow.
"""

from datetime import datetime, timedelta, timezone
from typing import Optional

from jose import JWTError, jwt
import bcrypt

from app.core.config import settings

ACCESS_TOKEN_TYPE = "access"
REFRESH_TOKEN_TYPE = "refresh"
REFRESH_TOKEN_EXPIRE_DAYS = 30


# ---------------------------------------------------------------------------
# Password utilities
# ---------------------------------------------------------------------------

def hash_password(plain: str) -> str:
    salt = bcrypt.gensalt()
    hashed = bcrypt.hashpw(plain.encode('utf-8'), salt)
    return hashed.decode('utf-8')


def verify_password(plain: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(plain.encode('utf-8'), hashed.encode('utf-8'))
    except ValueError:
        return False


# ---------------------------------------------------------------------------
# Token utilities
# ---------------------------------------------------------------------------

def create_access_token(subject: str) -> str:
    """Create a short-lived JWT access token."""
    return _build_token(
        subject=subject,
        token_type=ACCESS_TOKEN_TYPE,
        expires_delta=timedelta(minutes=settings.access_token_expire_minutes),
    )


def create_refresh_token(subject: str) -> str:
    """Create a long-lived JWT refresh token."""
    return _build_token(
        subject=subject,
        token_type=REFRESH_TOKEN_TYPE,
        expires_delta=timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS),
    )


def decode_token(token: str) -> dict:
    """
    Decode and validate a JWT. Raises JWTError on failure.
    Returns the full claims dict.
    """
    return jwt.decode(
        token,
        settings.jwt_secret,
        algorithms=[settings.jwt_algorithm],
    )


def get_subject(token: str, expected_type: str = ACCESS_TOKEN_TYPE) -> Optional[str]:
    """Extract subject from token; return None if invalid or wrong type."""
    try:
        payload = decode_token(token)
        if payload.get("type") != expected_type:
            return None
        return payload.get("sub")
    except JWTError:
        return None


# ---------------------------------------------------------------------------
# Private helpers
# ---------------------------------------------------------------------------

def _build_token(subject: str, token_type: str, expires_delta: timedelta) -> str:
    now = datetime.now(timezone.utc)
    payload = {
        "sub": subject,
        "type": token_type,
        "iat": now,
        "exp": now + expires_delta,
    }
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)

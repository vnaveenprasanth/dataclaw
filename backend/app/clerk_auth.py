import os
import jwt
from functools import wraps
from flask import request, jsonify, current_app


def verify_clerk_token(token: str) -> dict:
    """
    Verify a Clerk session JWT using RS256 + PEM public key.

    Clerk session tokens:
    - Signed with RS256 (asymmetric)
    - No 'aud' claim by default — skip audience verification
    - Contains 'sub' = clerk_user_id, 'azp' = origin that issued the token
    - exp / nbf validated by PyJWT automatically

    Returns the decoded payload dict.
    Raises jwt.PyJWTError or ValueError on any failure.
    """
    pem_key = current_app.config["CLERK_PEM_PUBLIC_KEY"]
    if not pem_key:
        raise ValueError("CLERK_PEM_PUBLIC_KEY is not configured")

    payload = jwt.decode(
        token,
        pem_key,
        algorithms=["RS256"],
        options={"verify_aud": False},  # Clerk does not set aud
    )

    # Validate authorized party (azp) to prevent CSRF
    permitted = current_app.config.get("CLERK_PERMITTED_ORIGINS", [])
    azp = payload.get("azp")
    if azp and permitted and azp not in permitted:
        raise ValueError(f"Token azp '{azp}' not in permitted origins")

    return payload


def clerk_required(f):
    """
    Flask route decorator that:
    1. Extracts Bearer token from Authorization header
    2. Verifies it against Clerk's PEM public key (RS256)
    3. Injects 'clerk_user_id' (the JWT 'sub' claim) into route kwargs

    Usage:
        @bp.route("/api/data")
        @clerk_required
        def my_route(clerk_user_id: str):
            ...
    """
    @wraps(f)
    def decorated(*args, **kwargs):
        auth_header = request.headers.get("Authorization", "")
        if not auth_header.startswith("Bearer "):
            return jsonify({"error": "Missing or malformed Authorization header"}), 401

        token = auth_header.split(" ", 1)[1].strip()
        if not token:
            return jsonify({"error": "Empty token"}), 401

        try:
            payload = verify_clerk_token(token)
            clerk_user_id = payload.get("sub")
            if not clerk_user_id:
                return jsonify({"error": "Token missing sub claim"}), 401
            kwargs["clerk_user_id"] = clerk_user_id
            return f(*args, **kwargs)
        except jwt.ExpiredSignatureError:
            return jsonify({"error": "Token has expired"}), 401
        except jwt.InvalidTokenError as e:
            return jsonify({"error": "Invalid token", "detail": str(e)}), 401
        except ValueError as e:
            return jsonify({"error": str(e)}), 401
        except Exception as e:
            current_app.logger.error(f"[clerk_auth] unexpected error: {e}")
            return jsonify({"error": "Authentication failed"}), 401

    return decorated

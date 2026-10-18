from pwdlib import PasswordHash

# Argon2id with pwdlib's recommended parameters; they are stored inside each hash.
password_hash = PasswordHash.recommended()


def hash_password(password: str) -> str:
    return password_hash.hash(password)


def verify_password(password: str, hashed_password: str) -> bool:
    return password_hash.verify(password, hashed_password)

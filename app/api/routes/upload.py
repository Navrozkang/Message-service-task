from fastapi import APIRouter, UploadFile, File, Form
import os
import uuid
from app.db.mongo import messages_collection
from app.db.redis import redis_client
import json

router = APIRouter()

UPLOAD_DIR = "uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)


@router.post("/upload-image")
async def upload_image(
    file: UploadFile = File(...),
    sender: str = Form(...),
    receiver: str = Form(None),
    group: str = Form(None),
):
    ext = file.filename.split(".")[-1]
    filename = f"{uuid.uuid4()}.{ext}"
    filepath = os.path.join(UPLOAD_DIR, filename)

    with open(filepath, "wb") as f:
        f.write(await file.read())

    # ✅ FULL URL (VERY IMPORTANT)
    image_url = f"http://127.0.0.1:8000/uploads/{filename}"

    # ✅ SAME STRUCTURE AS TEXT MESSAGE
    msg = {
        "type": "group" if group else "personal",
        "sender": sender,
        "receiver": receiver,
        "group": group,
        "content": None,
        "image": image_url,
    }

    result = await messages_collection.insert_one(msg)
    msg["_id"] = str(result.inserted_id)

    # ✅ send via redis (so websocket works)
    redis_client.publish("chat", json.dumps(msg))

    return {"image_url": image_url}
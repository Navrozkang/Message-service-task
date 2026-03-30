from fastapi import WebSocket
from typing import Dict, List
from app.db.mongo import db


class ConnectionManager:
    def __init__(self):
        self.active_connections: Dict[str, List[WebSocket]] = {}

    async def connect(self, user_id: str, websocket: WebSocket):
        await websocket.accept()

        if user_id not in self.active_connections:
            self.active_connections[user_id] = []

        self.active_connections[user_id].append(websocket)

    def disconnect(self, user_id: str, websocket: WebSocket):
        if user_id in self.active_connections:
            self.active_connections[user_id].remove(websocket)

    async def send_personal_message(self, user_id: str, message: dict):
        if user_id in self.active_connections:
            for connection in self.active_connections[user_id]:
                await connection.send_json(message)

    async def send_group_message(self, members: List[str], message: dict):
        for member in members:
            if member in self.active_connections:
                for connection in self.active_connections[member]:
                    await connection.send_json(message)

    async def handle_message(self, data: dict):
        """
        Handles both text + image messages
        """

        message = {
            "sender": data["sender"],
            "receiver": data.get("receiver"),
            "group": data.get("group"),
            "content": data.get("content"),
            "image": data.get("image"),
        }

        await db.messages.insert_one(message)

        if data.get("receiver"):
            await self.send_personal_message(data["receiver"], message)
            await self.send_personal_message(data["sender"], message)

        elif data.get("group"):
            group = await db.groups.find_one({"name": data["group"]})
            if group:
                members = group["members"]
                await self.send_group_message(members, message)


manager = ConnectionManager()


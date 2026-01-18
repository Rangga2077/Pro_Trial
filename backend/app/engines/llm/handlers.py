from app.engines.llm.client import llm_client
import json

class ConversationHandler:
    def __init__(self):
        self.history = []
        self.system_prompt = "You are a helpful culinary assistant. Keep answers concise."

    def add_user_message(self, message: str):
        self.history.append({"role": "user", "content": message})

    def add_assistant_message(self, message: str):
        self.history.append({"role": "assistant", "content": message})

    async def get_response(self, user_input: str) -> str:
        self.add_user_message(user_input)
        
        # specific prompt construction logic for Ollama (simplified)
        prompt = f"System: {self.system_prompt}\nUser: {user_input}\nAssistant:"
        
        response = await llm_client.generate(prompt)
        self.add_assistant_message(response)
        return response

    def clear_history(self):
        self.history = []

conversation_handler = ConversationHandler()

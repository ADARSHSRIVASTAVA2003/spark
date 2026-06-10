import api from '../api/client';

export async function startConversation(userId) {
  const { data } = await api.post('/chat/conversations/direct', { userId });
  return data.conversation.id;
}

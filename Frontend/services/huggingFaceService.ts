import API from '../apiClient';

export const classifySymptom = async (text: string, candidateLabels: string[]) => {
    try {
        const response = await API.post('/assistant/classify', { text, candidateLabels });
        return { label: response.data.label };
    } catch (error) {
        console.error("HF Error:", error);
        return { label: "General" };
    }
};
export type AssistantHistoryItem = {
    role: 'user' | 'assistant';
    content: string;
};

export const chatWithAssistantLLM = async (message: string, history: AssistantHistoryItem[] = []) => {
    try {
        const response = await API.post('/assistant/chat', { message, history });
        return response.data?.response || "I'm sorry, I couldn't process that.";
    } catch (error: any) {
        console.error("Chat Error:", error);
        return error.response?.data?.detail || "Assistant is currently offline. Please try again later.";
    }
};

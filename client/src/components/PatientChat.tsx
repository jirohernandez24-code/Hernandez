import { useState, useRef, useEffect } from 'react';
import { useSimulation } from '../hooks/useSimulation';

export default function PatientChat() {
  const { state, sendChatMessage } = useSimulation();
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const prevMsgCount = useRef(state.messages.length);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    if (state.messages.length > prevMsgCount.current) {
      setIsTyping(false);
    }
    prevMsgCount.current = state.messages.length;
  }, [state.messages]);

  const handleSend = () => {
    const trimmed = input.trim();
    if (!trimmed) return;
    sendChatMessage(trimmed);
    setInput('');
    setIsTyping(true);
  };

  const quickMessages = [
    "How are you feeling?",
    "Can you describe your pain?",
    "When did symptoms start?",
    "Any allergies I should know about?",
    "I'm going to check your vitals now.",
    "Do you have any questions?",
  ];

  return (
    <div className="h-full flex flex-col">
      {/* Chat Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {state.messages.map((msg) => (
          <div key={msg.id} className={`flex ${msg.role === 'student' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[75%] rounded-2xl px-4 py-2.5 ${
              msg.role === 'student'
                ? 'bg-medical-blue text-white rounded-br-md'
                : msg.role === 'system'
                ? 'bg-gray-100 text-gray-600 italic text-sm'
                : 'bg-white border shadow-sm rounded-bl-md'
            }`}>
              {msg.role === 'patient' && (
                <p className="text-xs font-medium text-medical-green mb-1">
                  {state.scenario?.patient.name}
                </p>
              )}
              <p className="text-sm leading-relaxed">{msg.content}</p>
            </div>
          </div>
        ))}

        {isTyping && (
          <div className="flex justify-start">
            <div className="bg-white border shadow-sm rounded-2xl rounded-bl-md px-4 py-3">
              <div className="flex gap-1">
                {[0, 1, 2].map((i) => (
                  <div key={i} className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"
                    style={{ animationDelay: `${i * 0.15}s` }} />
                ))}
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Quick Messages */}
      <div className="px-4 py-2 border-t bg-gray-50 flex gap-2 overflow-x-auto">
        {quickMessages.map((msg, i) => (
          <button
            key={i}
            onClick={() => { sendChatMessage(msg); setIsTyping(true); }}
            className="text-xs bg-white border rounded-full px-3 py-1.5 text-gray-600 hover:bg-blue-50 hover:border-medical-blue whitespace-nowrap transition-colors"
          >
            {msg}
          </button>
        ))}
      </div>

      {/* Input */}
      <div className="p-4 border-t bg-white">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            placeholder="Speak to your patient..."
            className="flex-1 border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-medical-blue focus:border-transparent"
          />
          <button onClick={handleSend} disabled={!input.trim()} className="btn-primary">Send</button>
        </div>
      </div>
    </div>
  );
}

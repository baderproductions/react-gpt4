import { ChangeEvent, KeyboardEvent, useEffect, useRef, useState } from "react";
import logo from '../public/logo.png'
import hljs from 'highlight.js';
import axios from "axios";

type Message = {
  from: 'user' | 'gpt';
  text: string;
};

type MessageHistory = {
  role: string
  content: string;
};

const trim_conversation_history = (
  conversation_history: MessageHistory[],
  history_length: number
): MessageHistory[] => {
  if (conversation_history.length > history_length) {
    return conversation_history.slice(-history_length);
  } else {
    return conversation_history;
  }
};

const HighlightedCode = ({ code }: { code: string }) => {
  const codeRef = useRef<HTMLPreElement>(null);

  useEffect(() => {
    if (codeRef.current) {
      hljs.highlightElement(codeRef.current);
    }
  }, [code]);

  return (
    <pre ref={codeRef} className="whitespace-pre-wrap">
      <code>{code}</code>
    </pre>
  );
};

const SYSTEM_MESSAGE = 'You are an AI programming assistant. Follow the user requirements carefully & to the letter. Then output the code in a single code block. Minimize any other prose.';

export default function App() {
  const [rows, setRows] = useState(1);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState<string>('');

  console.log(import.meta.env.VITE_HISTORY_LENGTH);

  const conversation_history = useRef<MessageHistory[]>([]);

  const gptResponse = useRef<null | ((input: string) => Promise<string>)>(async (input: string) => {
    conversation_history.current.push({
      role: 'system',
      content: `The user is user. ${SYSTEM_MESSAGE}`,
    });
    conversation_history.current.push({ role: 'user', content: input });
    conversation_history.current = trim_conversation_history(conversation_history.current, +import.meta.env.VITE_HISTORY_LENGTH);

    console.log('conversation_history 1', conversation_history.current)

    try {
      const response = await axios.post(
        import.meta.env.VITE_OPENAI_API,
        {
          model: "gpt-4",
          messages: conversation_history.current,
        },
        {
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${import.meta.env.VITE_OPENAI_API_KEY}`,
          },
        }
      );

      const assistant_response = response?.data?.choices?.[0]?.message?.content;
      conversation_history.current.push({ role: 'assistant', content: assistant_response });
      conversation_history.current = trim_conversation_history(conversation_history.current, +import.meta.env.VITE_HISTORY_LENGTH);

      console.log('conversation_history 2', conversation_history.current)

      return assistant_response;
    } catch (error) {
      const typedError = error as {data?: {error?: {message?: string;}}};
      console.error(`Error: ${typedError?.data?.error?.message}`);
    }
  });

  const handleInputChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
    setInputValue(e.target.value);
  };

  const handleInputKeyPress = (e: KeyboardEvent<HTMLTextAreaElement>) => {

    if (e.shiftKey && e.key === 'Enter') {
      e.preventDefault();
      const target = e.target as HTMLTextAreaElement;
      const cursorPosition = target.selectionStart;
      setInputValue(
        inputValue.slice(0, cursorPosition) +
          '\n' +
          inputValue.slice(cursorPosition)
      );
      setTimeout(() => {
        target.selectionStart = target.selectionEnd = cursorPosition + 1;
      }, 0);
    } else if (e.key === 'Enter' && inputValue.trim() !== '') {
      setMessages([...messages, { from: 'user', text: inputValue.trim() }]);

      if (gptResponse.current) gptResponse.current(inputValue.trim()).then((response) => {
        setMessages((prevMessages) => [...prevMessages, { from: 'gpt', text: response }]);
        // scroll to bottom
        const messagesContainer = document.getElementById('messages-container');
        if (messagesContainer) {
          setTimeout(() => messagesContainer.scrollTop = messagesContainer.scrollHeight, 500);
        }
      });

      setInputValue('');
      // scroll to bottom
      const messagesContainer = document.getElementById('messages-container');
      if (messagesContainer) {
        setTimeout(() => messagesContainer.scrollTop = messagesContainer.scrollHeight, 500);
      }
    }
  };

  useEffect(() => {
    setRows(inputValue.split("\n").length);
  }, [inputValue]);

  const mainContainer = document.getElementById('html-container');

  return (
    <div className="min-h-screen overflow-x-hidden overflow-y-auto py-5 bg-gray-800 flex flex-col justify-center items-center scroll-smooth">
      <div id="messages-container" className="p-6 w-[90%] h-[calc(100vh-150px)] bg-blue-50 rounded-xl flex flex-col overflow-x-hidden overflow-y-auto scroll-smooth">
        {messages?.length ? messages?.map((message, index) => {
          return (
            <div key={`message_${index}`} className={`flex rounded-xl p-2 pr-4 ${message.from === 'gpt' ? 'bg-white shadow-[0_0_0_2px_#CCC]' :  'bg-white shadow-[0_0_0_2px_#96D1C1] justify-end' } ${message.from === 'gpt' && !message.text ? 'items-center shadow-[0_0_0_2px_#FFAFAE]' : ''} ${index === messages.length - 1 ? '' : 'mb-3'}`}>
              <div className='w-10 min-w-10 h-10 min-h-10 mr-2'>
                <img width="1280" height="1280" src={message.from === 'gpt' ? logo : "https://cdn.pixabay.com/photo/2016/08/08/09/17/avatar-1577909_1280.png"} alt="Message profile image" className="rounded-full" />
              </div>
              <span className={`w-full ${!message.text ? 'text-red-400' : ''}`}>
                {message.text ? <HighlightedCode code={message.text}/> : 'There was an error'}
              </span>
            </div>
          );
        }) : (
          <div className="h-full flex flex-col justify-center items-center">
            <p className="text-gray-600 text-center text-sm font-bold">Start the conversation</p>
          </div>
        )}
        {messages.length > 0 && messages[messages.length - 1].from === 'user' && (
          <div className="flex flex-col justify-center items-center mt-6">
            <span className="text-gray-600 flex text-center text-sm font-bold">
              <div>
                <svg className="animate-spin -ml-1 mr-2 h-5 w-5 text-black" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
              </div>
              GPT is typing...
            </span>
          </div>
        )}
      </div>
      <div className="relative mt-2 w-[90%]">
        <textarea
          rows={rows}
          className="w-full p-4 rounded-xl resize-none focus:ring-0 focus:outline-none"
          value={inputValue}
          onPaste={() => {
            setTimeout(() => {
              if (mainContainer) mainContainer.scrollTop = mainContainer.scrollHeight;
            }, 50);
          }}
          onChange={handleInputChange}
          onKeyDown={handleInputKeyPress}
          disabled={messages.length > 0 && messages[messages.length - 1].from === 'user'}
          placeholder={messages.length > 0 && messages[messages.length - 1].from === 'user' ? '' : "Type your message here..."}
        />
        {messages.length > 0 && messages[messages.length - 1].from === 'user' && (
          <div className="absolute top-1/2 -translate-y-1/2 left-5">
            <svg className="animate-spin -ml-1 mr-2 h-5 w-5 text-black" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
          </div>
        )}
      </div>
    </div>
  )
}
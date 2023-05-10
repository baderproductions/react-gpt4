import {ChangeEvent, KeyboardEvent, useCallback, useEffect, useRef, useState,} from 'react';
import axios, {AxiosResponse,} from 'axios';
import {useTriggerFunctionOnce, useWindowFocus, useWindowTitleChanger,} from './utils';
import logo from '../public/logo.png';
import CryptoJS from 'crypto-js';
import hljs from 'highlight.js';

type Message = {
  from: 'user' | 'gpt';
  text: string;
};

type MessageHistory = {
  role: string
  content: string;
};

type AxiosResponseData = AxiosResponse<Record<string, Record<string, Record<string, Record<string, string>>>>>;

const trimConversationHistory = (
	conversationHistory: MessageHistory[],
	historyLength: number
): MessageHistory[] => {
	if (conversationHistory.length > historyLength) {
		return conversationHistory.slice(-historyLength);
	} else {
		return conversationHistory;
	}
};

const HighlightedCode = ({code,}: { code: string }) => {
	const codeRef = useRef<HTMLPreElement>(null);

	useEffect(() => {
		if (codeRef.current) {
			hljs.highlightElement(codeRef.current);
		}
	}, [code]);

	return (
		<pre
			ref={ codeRef }
			className="whitespace-pre-wrap">
			<code>{code}</code>
		</pre>
	);
};

const SYSTEM_MESSAGE = 'You are an AI programming assistant. Follow the user requirements carefully & to the letter. Then output the code in a single code block. Minimize any other prose.';

export default function App() {
	const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);

	const [rows, setRows] = useState(1);
	const [messages, setMessages] = useState<Message[]>([]);
	const [inputValue, setInputValue] = useState<string>('');

	const inputRef = useRef<HTMLTextAreaElement>(null);
	const conversationHistory = useRef<MessageHistory[]>([]);

	const {startChangingTitle, stopChangingTitle,} = useWindowTitleChanger({
		initialTitle: 'GPT',
		notificationTitle: 'You got a message',
		interval: 1000,
	});

	const {isFocused,} = useWindowFocus();
	const mainContainer = document.getElementById('html-container');

	useTriggerFunctionOnce(stopChangingTitle);

	useEffect(() => {
		if (isFocused) stopChangingTitle();
	}, [isFocused]);

	useEffect(() => {
		setRows(inputValue.split('\n').length);
	}, [inputValue]);

	useEffect(() => {
		const promptPassword = () => {
			const enteredPassword = prompt('Password:');

			if (enteredPassword !== null) {
				const hashedPassword = CryptoJS.SHA256(enteredPassword).toString();

				if (hashedPassword === import.meta.env.VITE_SHA256) {
					setIsAuthenticated(true);
				} else {
					alert('Unauthorized.');
					promptPassword();
				}
			}
		};

		if (!isAuthenticated) {
			promptPassword();
		} else {
			if (inputRef.current) inputRef.current.focus();
		}
	}, [isAuthenticated]);

	const gptResponse = useRef<null | ((input: string) => Promise<string | undefined>)>(async (input: string) => {
		conversationHistory.current.push({
			role: 'system',
			content: `The user is user. ${SYSTEM_MESSAGE}`,
		});
		conversationHistory.current.push({role: 'user', content: input,});
		conversationHistory.current = trimConversationHistory(conversationHistory.current, +import.meta.env.VITE_HISTORY_LENGTH);

		try {
			const response: AxiosResponseData = await axios.post(
				import.meta.env.VITE_OPENAI_API as string,
				{
					model: 'gpt-4',
					messages: conversationHistory.current,
				},
				{
					headers: {
						'Content-Type': 'application/json',
						Authorization: `Bearer ${import.meta.env.VITE_OPENAI_API_KEY  as string}`,
					},
				}
			);

			const assistantResponse = response?.data?.choices?.[0]?.message?.content;
			conversationHistory.current.push({role: 'assistant', content: assistantResponse,});
			conversationHistory.current = trimConversationHistory(conversationHistory.current, +import.meta.env.VITE_HISTORY_LENGTH);

			return assistantResponse;
		} catch (error) {
			const typedError = error as {data?: {error?: {message?: string;}}};
			// eslint-disable-next-line no-console
			console.error(`Error: ${typedError?.data?.error?.message as string}`);
		}
	});

	const handleInputChange = useCallback((e: ChangeEvent<HTMLTextAreaElement>) => {
		setInputValue(e.target.value);
	}, []);

	const onTextPaste = useCallback(() => {
		setTimeout(() => {
			if (mainContainer) mainContainer.scrollTop = mainContainer.scrollHeight;
		}, 50);
	}, [mainContainer]);

	const handleInputKeyPress = (e: KeyboardEvent<HTMLTextAreaElement>) => {
		if (e.shiftKey && e.key === 'Enter') {
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
			setMessages([...messages, {from: 'user', text: inputValue.trim(),}]);

			if (gptResponse.current) gptResponse.current(inputValue.trim()).then(response => {
				setMessages(prevMessages => [...prevMessages, {from: 'gpt', text: response,}] as Message[]);
				// scroll to bottom and re-focus input
				const messagesContainer = document.getElementById('messages-container');
				if (messagesContainer) {
					setTimeout(() => {
						messagesContainer.scrollTop = messagesContainer.scrollHeight;
						inputRef.current?.focus();
					}, 500);
				}
				// trigger title change notification
				startChangingTitle();
				// eslint-disable-next-line no-console
			}).catch(error => console.log('gptResponse catch: ', error));

			setInputValue('');
			// scroll to bottom
			const messagesContainer = document.getElementById('messages-container');
			if (messagesContainer) {
				setTimeout(() => messagesContainer.scrollTop = messagesContainer.scrollHeight, 500);
			}
		}
	};
	
	return isAuthenticated ? (
		<div className="min-h-screen overflow-x-hidden overflow-y-auto py-5 bg-gray-800 flex flex-col justify-center items-center scroll-smooth">
			<div
				id="messages-container"
				className="p-4 py-6 w-[90%] h-[calc(100vh-150px)] bg-blue-50 rounded-xl flex flex-col overflow-x-hidden overflow-y-auto scroll-smooth">
				{messages?.length ? messages?.map((message, index) => {
					return (
						<div 
							key={ `message_${index}` }
							className='w-full flex items-end'>
							{message.from === 'gpt' && (
								<div className='flex flex-none items-center space-x-1 mr-1 -mb-0.5 select-none'>
									<img
										width="1280"
										height="1280"
										draggable="false"
										src={ logo }
										alt="GPT Avatar"
										className="w-8 h-8 rounded-full select-none"/>
								</div>
							)}
							{message.from === 'user' && <div className="flex-none w-9 h-9"/>}
							<div
								className={ `flex rounded-xl p-2 pr-4 ${message.from === 'gpt' ? 'bg-white shadow-[0_0_0_1px_#AAA] mr-auto rounded-bl-none' :  'bg-white shadow-[0_0_0_1px_#25D366] ml-auto justify-end rounded-br-none my-3' } ${message.from === 'gpt' && !message.text ? 'items-center shadow-[0_0_0_1px_#FFAFAE]' : ''}` }>
								<span className={ `w-full ${!message.text ? 'text-red-400' : ''}` }>
									{message.text ? <HighlightedCode code={ message.text }/> : 'There was an error'}
								</span>
							</div>
							{message.from === 'gpt' && <div className="flex-none w-8 h-8"/>}
							{message.from === 'user' && (
								<div className='flex flex-none items-center space-x-1 ml-1.5 mb-3 select-none'>
									<img
										width="1280"
										height="1280"
										draggable="false"
										src="https://cdn.pixabay.com/photo/2016/08/08/09/17/avatar-1577909_1280.png"
										alt="User Avatar"
										className="w-[26px] h-[26px] rounded-full select-none"/>
								</div>
							)}
						</div>
					);
				}) : (
					<div className="h-full flex flex-col justify-center items-center">
						<p className="text-gray-600 text-center text-sm font-bold">Start the conversation</p>
					</div>
				)}
				{messages.length > 0 && messages[messages.length - 1].from === 'user' && (
					<div className="flex flex-col justify-center items-center mt-3">
						<span className="text-gray-600 flex text-center text-sm font-bold">
							<div>
								<svg
									className="animate-spin -ml-1 mr-2 h-5 w-5 text-black"
									fill="none"
									viewBox="0 0 24 24">
									<circle
										className="opacity-25"
										cx="12"
										cy="12"
										r="10"
										stroke="currentColor"
										strokeWidth="4"></circle>
									<path
										className="opacity-75"
										fill="currentColor"
										d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
								</svg>
							</div>
							Searching...
						</span>
					</div>
				)}
			</div>
			<div className="mt-2 w-[90%]">
				<textarea
					ref={ inputRef }
					rows={ rows }
					className="w-full p-4 rounded-xl resize-none focus:ring-0 focus:outline-none"
					value={ inputValue }
					onPaste={ onTextPaste }
					onChange={ handleInputChange }
					onKeyDown={ handleInputKeyPress as unknown as React.KeyboardEventHandler<HTMLTextAreaElement> }
					disabled={ messages.length > 0 && messages[messages.length - 1].from === 'user' }
					placeholder={ messages.length > 0 && messages[messages.length - 1].from === 'user' ? '' : 'Type your message here...' }
				/>
			</div>
		</div>
	) : (
		<div className="h-screen overflow-hidden bg-gray-800 flex flex-col justify-center items-center">
			<h1 className="text-white">Access denied</h1>
		</div>
	);
}
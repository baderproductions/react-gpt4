import {ChangeEvent, Fragment, KeyboardEvent, useCallback, useEffect, useRef, useState,} from 'react';
import axios, {AxiosResponse,} from 'axios';
import {useTriggerFunctionOnce, useWindowFocus, useWindowTitleChanger,} from './utils';
import {BiEdit, BiInfoCircle, BiSave,} from 'react-icons/bi';
import {Popover, Transition,} from '@headlessui/react';
import {MdLockReset,} from 'react-icons/md';
import {FiSettings,} from 'react-icons/fi';
import logo from '../public/logo.png';
import CryptoJS from 'crypto-js';
import hljs from 'highlight.js';

type Message = {
	from: 'user' | 'gpt'
	text: string
};

type MessageHistory = {
	role: string
	content: string
};

type AxiosResponseData = AxiosResponse<Record<string, Record<string, Record<string, Record<string, string>>>>>

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

const SYSTEM_MESSAGE = 'You are an AI programming assistant. Follow the user requirements carefully & to the letter. Then output the code in a single code block. Use typescript instead of javascript and tsx instead of jsx when asked javascript related questions. Minimize any other prose.';

export default function App() {
	const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);

	const [rows, setRows] = useState(1);
	const [rowsSM, setRowsSM] = useState(SYSTEM_MESSAGE.split('\n').length);
	const [messages, setMessages] = useState<Message[]>([]);
	const [inputValue, setInputValue] = useState<string>('');
	const [inputValueSM, setInputValueSM] = useState<string>(SYSTEM_MESSAGE);
	const [smDisabled, setSMDisabled] = useState<boolean>(true);

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
		setRowsSM(inputValueSM.split('\n').length);
	}, [inputValueSM]);

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

	const gptResponse = useRef<null | ((input: string) => Promise<string | undefined>)>(null);

	const updateGptResponseFunction = useCallback(() => {
		gptResponse.current = async (input: string) => {
			conversationHistory.current.push({
				role: 'system',
				content: `The user is user. ${inputValueSM}`,
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
		};
	}, [inputValueSM]);

	useEffect(() => {
		updateGptResponseFunction();
	}, [updateGptResponseFunction]);

	const toggleSMDisabled = useCallback(() => {
		conversationHistory.current = [];
		setSMDisabled(!smDisabled);
	}, [smDisabled]);

	const onReset = useCallback(() => {
		setInputValueSM(SYSTEM_MESSAGE);
		conversationHistory.current = [];
		setMessages([]);
		setSMDisabled(true);
	}, []);

	const handleInputChange = useCallback((e: ChangeEvent<HTMLTextAreaElement>) => {
		setInputValue(e.target.value);
	}, []);

	const handleInputChangeSM = useCallback((e: ChangeEvent<HTMLTextAreaElement>) => {
		setInputValueSM(e.target.value);
	}, []);

	const onTextPaste = useCallback(() => {
		setTimeout(() => {
			if (mainContainer) mainContainer.scrollTop = mainContainer.scrollHeight;
		}, 50);
	}, [mainContainer]);

	const handleInputKeyPressSM = (e: KeyboardEvent<HTMLTextAreaElement>) => {
		if (e.shiftKey && e.key === 'Enter') {
			e.preventDefault();
			const target = e.target as HTMLTextAreaElement;
			const cursorPosition = target.selectionStart;
			setInputValueSM(
				inputValueSM.slice(0, cursorPosition) +
			'\n' +
			inputValueSM.slice(cursorPosition)
			);
			setTimeout(() => {
				target.selectionStart = target.selectionEnd = cursorPosition + 1;
			}, 0);
		}
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
		<div className="min-h-screen overflow-x-hidden overflow-y-auto py-3 bg-black flex flex-col justify-center items-center scroll-smooth">
			<Popover
				as="div"
				className="relative mb-3">
				<Popover.Button className="rounded-md bg-black p-2 text-sm font-medium text-white hover:bg-opacity-30 focus:outline-none">
					<FiSettings className="w-6 h-6 text-white"/>
				</Popover.Button>
				<Transition
					as={ Fragment }
					enter="transition ease-out duration-100"
					enterFrom="transform opacity-0 scale-95"
					enterTo="transform opacity-100 scale-100"
					leave="transition ease-in duration-75"
					leaveFrom="transform opacity-100 scale-100"
					leaveTo="transform opacity-0 scale-95"
				>
					<Popover.Panel className="absolute left-1/2 -translate-x-1/2 mt-1.5 w-[300px] h-40 origin-top-right divide-y divide-gray-100 rounded-md bg-white shadow-md ring-1 ring-black ring-opacity-5 focus:outline-none">
						<div className="w-full h-full flex flex-col justify-between p-2">
							<label className='flex items-center text-gray-500 text-xs mb-1'>
								<BiInfoCircle
									className="w-4 h-4 text-gray-600 mr-1"
									title="The system message helps set the behavior of the assistant."/>
								GPT System Message
							</label>
							<textarea
								rows={ rowsSM }
								className="w-full h-3/4 px-2.5 py-1.5 rounded-md resize-none focus:ring-0 focus:outline-none  bg-gray-100 disabled:bg-gray-200 disabled:text-gray-400"
								value={ inputValueSM }
								onChange={ handleInputChangeSM }
								onKeyDown={ handleInputKeyPressSM as unknown as React.KeyboardEventHandler<HTMLTextAreaElement> }
								disabled={ smDisabled }
								placeholder="The system message helps set the behavior of the assistant"
							/>
							<div className="flex justify-between space-x-4 mt-2">
								<button
									type='button'
									onClick={ toggleSMDisabled }
									className="h-max flex items-center space-x-2 rounded-md bg-black p-2 text-sm font-medium text-white hover:bg-opacity-90 focus:outline-none"
								>	
									{smDisabled ? (
										<>
											<BiEdit className="w-5 h-5 text-white"/>
											<span className='text-sm'>EDIT</span>
										</>
									) : (
										<Popover.Button
											as="span"
											className="h-max flex items-center space-x-2">
											<BiSave className="w-5 h-5 text-white"/>
											<span className='text-sm'>SAVE</span>
										</Popover.Button>
									)}
									
								</button>
								<button
									type='button'
									onClick={ onReset }
									className="h-max flex items-center space-x-2 rounded-md bg-black p-2 text-sm font-medium text-white hover:bg-opacity-90 focus:outline-none"
								>
									<MdLockReset className="w-5 h-5 text-white"/>
									<span className='text-sm'>RESET</span>
								</button>
							</div>
						</div>
					</Popover.Panel>
				</Transition>
			</Popover>
			<div
				id="messages-container"
				className="p-4 py-4 w-[90%] h-[calc(100vh-150px)] shadow-[inset_0_0_6px_0_#00000040] border border-gray-200 bg-gray-200 rounded-xl flex flex-col overflow-x-hidden overflow-y-auto scroll-smooth">
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
								className={ `flex rounded-xl p-2 pr-4 ${message.from === 'gpt' ? 'bg-[#1e1e1e] shadow-[0_0_0_2px_#AAA] mr-auto rounded-bl-none' :  'bg-[#1e1e1e] shadow-[0_0_0_2px_#a0c1fa] ml-auto justify-end rounded-br-none my-4' } ${message.from === 'gpt' && !message.text ? 'items-center shadow-[0_0_0_1px_#FFAFAE]' : ''}` }>
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
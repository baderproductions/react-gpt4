import {useEffect, useRef, useState,} from 'react';

export const useWindowFocus = () => {
	const [isFocused, setIsFocused] = useState<boolean>(document.hasFocus());

	function handleVisibility(forcedFlag: Event) {
		if (typeof forcedFlag === 'boolean') {
			return forcedFlag ? setIsFocused(true) : setIsFocused(false);
		}
    
		return document.hidden ? setIsFocused(false) : setIsFocused(true);
	}

	useEffect(() => {
		const onFocus = () => setIsFocused(true);
		const onBlur = () => setIsFocused(false);
    
		document.addEventListener('visibilitychange', handleVisibility);
		document.addEventListener('focus', onFocus);
		document.addEventListener('blur', onBlur);
		window.addEventListener('focus', onFocus);
		window.addEventListener('blur', onBlur);
    
		return () => {
			document.removeEventListener('visibilitychange', handleVisibility);
			document.removeEventListener('focus', onFocus);
			document.removeEventListener('blur', onBlur);
			window.removeEventListener('focus', onFocus);
			window.removeEventListener('blur', onBlur);
		};
	}, []);

	return {isFocused,};
};

export const useWindowTitleChanger = ({
	initialTitle,
	notificationTitle,
	interval,
}: {
    initialTitle: string;
	notificationTitle: string;
    interval: number;
}) => {
	const intervalRef = useRef<NodeJS.Timeout | null>(null);

	const startChangingTitle = () => {
		let isNotificationTitle = true;
		intervalRef.current = setInterval(() => {
			document.title = isNotificationTitle ? notificationTitle : initialTitle;
			isNotificationTitle = !isNotificationTitle;
		}, interval);
	};

	const stopChangingTitle = () => {
		if (intervalRef.current) {
			clearInterval(intervalRef.current as unknown as number);
			document.title = initialTitle;
		}
	};

	useEffect(() => {
		return () => stopChangingTitle();
	}, [initialTitle, notificationTitle, interval]);

	return {startChangingTitle, stopChangingTitle,};
};

export const useTriggerFunctionOnce = (triggerFunction: () => void) => {
	useEffect(() => {
		function handleEvent() {
			triggerFunction();
			['click', 'touchstart'].forEach(event => {
				window.removeEventListener(event, handleEvent);
			});
		}
	
		['click', 'touchstart'].forEach(event => {
			window.addEventListener(event, handleEvent);
		});
	
		return () => {
			['click', 'touchstart'].forEach(event => {
				window.removeEventListener(event, handleEvent);
			});
		};
	}, [triggerFunction]);
};
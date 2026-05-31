let toasts = $state([]);
let nextId = 0;

export function getToasts() {
	return toasts;
}

export function addToast(message, type = 'info', duration = 4000) {
	const id = nextId++;
	toasts = [...toasts, { id, message, type }];

	if (duration > 0) {
		setTimeout(() => {
			removeToast(id);
		}, duration);
	}

	return id;
}

export function removeToast(id) {
	toasts = toasts.filter((t) => t.id !== id);
}

export function success(message, duration) {
	return addToast(message, 'success', duration);
}

export function error(message, duration) {
	return addToast(message, 'error', duration);
}

export function warning(message, duration) {
	return addToast(message, 'warning', duration);
}

export function info(message, duration) {
	return addToast(message, 'info', duration);
}

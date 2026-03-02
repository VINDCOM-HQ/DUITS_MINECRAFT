let rcon = $state({ connected: false, host: '', port: 25575 });
let mysql = $state({ connected: false, host: '', port: 3306, database: '' });
let serverStatus = $state('unknown'); // 'running' | 'stopped' | 'starting' | 'error' | 'unknown'

export function getRcon() {
	return rcon;
}

export function setRcon(updates) {
	rcon = { ...rcon, ...updates };
}

export function getMysql() {
	return mysql;
}

export function setMysql(updates) {
	mysql = { ...mysql, ...updates };
}

export function getServerStatus() {
	return serverStatus;
}

export function setServerStatus(value) {
	serverStatus = value;
}

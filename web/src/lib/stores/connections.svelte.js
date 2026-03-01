let rcon = $state({ clientId: null, connected: false, host: '', port: 25575 });
let smb = $state({ clientId: null, connected: false, host: '', share: '' });
let mysql = $state({ clientId: null, connected: false, host: '', port: 3306, database: '' });
let agentOnline = $state(false);

export function getRcon() {
	return rcon;
}

export function setRcon(updates) {
	rcon = { ...rcon, ...updates };
}

export function getSmb() {
	return smb;
}

export function setSmb(updates) {
	smb = { ...smb, ...updates };
}

export function getMysql() {
	return mysql;
}

export function setMysql(updates) {
	mysql = { ...mysql, ...updates };
}

export function getAgentOnline() {
	return agentOnline;
}

export function setAgentOnline(value) {
	agentOnline = value;
}

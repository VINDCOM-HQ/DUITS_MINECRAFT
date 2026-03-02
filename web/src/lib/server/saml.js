import { SAML } from '@node-saml/node-saml';

/**
 * SAML 2.0 Service Provider module.
 * Uses @node-saml/node-saml for AuthnRequest generation and assertion validation.
 */

const SAML_IDP_METADATA_URL = process.env.WEB_PORTAL_SAML_IDP_METADATA_URL || '';
const SAML_ENTITY_ID = process.env.WEB_PORTAL_SAML_ENTITY_ID || '';
const SAML_CALLBACK_URL = process.env.WEB_PORTAL_SAML_CALLBACK_URL || '';

let samlInstance = null;
let metadataCache = null;
let metadataExpiry = 0;

/**
 * Check whether SAML is enabled and fully configured.
 */
export function isSamlEnabled() {
	return (
		process.env.WEB_PORTAL_SAML_ENABLED === 'true' &&
		SAML_IDP_METADATA_URL.length > 0 &&
		SAML_ENTITY_ID.length > 0 &&
		SAML_CALLBACK_URL.length > 0
	);
}

/**
 * Fetch and parse the IdP metadata to extract the SSO URL and signing cert.
 * Caches for 1 hour.
 */
async function fetchIdPMetadata() {
	if (metadataCache && Date.now() < metadataExpiry) {
		return metadataCache;
	}

	const res = await fetch(SAML_IDP_METADATA_URL);
	if (!res.ok) {
		throw new Error(`SAML metadata fetch failed: ${res.status} ${res.statusText}`);
	}

	const xml = await res.text();

	// Extract SSO URL (HTTP-Redirect binding)
	const ssoMatch = xml.match(
		/SingleSignOnService[^>]*Binding="urn:oasis:names:tc:SAML:2\.0:bindings:HTTP-Redirect"[^>]*Location="([^"]+)"/
	);
	const ssoUrl = ssoMatch?.[1] || '';

	// Extract signing certificate
	const certMatch = xml.match(/<ds:X509Certificate>([^<]+)<\/ds:X509Certificate>/);
	const cert = certMatch?.[1]?.replace(/\s/g, '') || '';

	if (!ssoUrl) {
		throw new Error('Could not extract SSO URL from IdP metadata');
	}

	if (!cert) {
		throw new Error('Could not extract signing certificate from IdP metadata');
	}

	metadataCache = { ssoUrl, cert };
	metadataExpiry = Date.now() + 60 * 60 * 1000;
	return metadataCache;
}

/**
 * Get or create the SAML instance.
 */
async function getSaml() {
	if (samlInstance) {
		return samlInstance;
	}

	const { ssoUrl, cert } = await fetchIdPMetadata();

	samlInstance = new SAML({
		callbackUrl: SAML_CALLBACK_URL,
		entryPoint: ssoUrl,
		issuer: SAML_ENTITY_ID,
		idpCert: cert,
		wantAssertionsSigned: true,
		wantAuthnResponseSigned: true
	});

	return samlInstance;
}

/**
 * Generate a SAML AuthnRequest redirect URL.
 * @returns {Promise<string>}
 */
export async function getLoginUrl() {
	const saml = await getSaml();
	const url = await saml.getAuthorizeUrlAsync('', undefined, {});
	return url;
}

/**
 * Validate a SAML assertion response.
 * @param {string} samlResponse - Base64-encoded SAMLResponse from POST binding
 * @returns {Promise<{nameId: string, displayName: string}>}
 */
export async function validateAssertion(samlResponse) {
	const saml = await getSaml();

	const { profile } = await saml.validatePostResponseAsync({
		SAMLResponse: samlResponse
	});

	if (!profile || !profile.nameID) {
		throw new Error('SAML assertion did not contain a NameID');
	}

	const displayName =
		profile.displayName ||
		profile.firstName ||
		profile.email ||
		profile.nameID;

	return {
		nameId: profile.nameID,
		displayName
	};
}

import fs from "node:fs";
import { Client } from "ldapts";

const INVALID_CREDENTIALS_CODE = 49;

export class LdapInvalidCredentialsError extends Error {
  constructor(message = "Invalid credentials") {
    super(message);
    this.name = "LdapInvalidCredentialsError";
  }
}

export class LdapServiceError extends Error {
  constructor(message = "LDAP service error") {
    super(message);
    this.name = "LdapServiceError";
  }
}

const escapeLdapFilter = (value) => {
  return value
    .replaceAll("\\", "\\5c")
    .replaceAll("*", "\\2a")
    .replaceAll("(", "\\28")
    .replaceAll(")", "\\29")
    .replaceAll("\u0000", "\\00");
};

const buildUserFilter = (template, username) => {
  const escaped = escapeLdapFilter(username);
  return template
    .replaceAll("{{username}}", escaped)
    .replaceAll("%s", escaped);
};

const buildTlsOptions = ({ tlsCaPath, rejectUnauthorized }) => {
  const options = {};
  if (tlsCaPath) {
    options.ca = [fs.readFileSync(tlsCaPath)];
  }
  if (rejectUnauthorized !== undefined) {
    options.rejectUnauthorized = rejectUnauthorized;
  }
  return Object.keys(options).length ? options : undefined;
};

const createLdapClient = (config) => {
  const tlsOptions = buildTlsOptions({
    tlsCaPath: config.tlsCaPath,
    rejectUnauthorized: config.rejectUnauthorized
  });

  const client = new Client({
    url: config.url,
    timeout: config.timeoutMs,
    connectTimeout: config.connectTimeoutMs,
    tlsOptions
  });

  return { client, tlsOptions };
};

const bindServiceAccount = async (client, config, tlsOptions) => {
  if (config.useStartTls) {
    await client.startTLS(tlsOptions ?? {});
  }

  await client.bind(config.bindDn, config.bindPassword);
};

const safeUnbind = async (client) => {
  try {
    await client.unbind();
  } catch {
    // ignore unbind errors
  }
};

export const authenticateLdapUser = async (config, { username, password }) => {
  const { client, tlsOptions } = createLdapClient(config);

  try {
    await bindServiceAccount(client, config, tlsOptions);

    const filter = buildUserFilter(config.userFilter, username);
    const { searchEntries } = await client.search(config.baseDn, {
      scope: "sub",
      filter,
      attributes: ["dn", "cn", "mail", "uid"]
    });

    const entry = searchEntries[0];
    if (!entry?.dn) {
      throw new LdapInvalidCredentialsError();
    }

    await client.bind(entry.dn, password);

    return {
      dn: entry.dn,
      attributes: entry
    };
  } catch (error) {
    if (error instanceof LdapInvalidCredentialsError) {
      throw error;
    }
    if (error?.code === INVALID_CREDENTIALS_CODE) {
      throw new LdapInvalidCredentialsError();
    }

    throw new LdapServiceError("LDAP authentication failed");
  } finally {
    await safeUnbind(client);
  }
};

export const searchLdapEntries = async (
  config,
  { filter, attributes = [], pageSize }
) => {
  const { client, tlsOptions } = createLdapClient(config);

  try {
    await bindServiceAccount(client, config, tlsOptions);

    const searchOptions = {
      scope: "sub",
      filter,
      attributes
    };

    if (pageSize) {
      searchOptions.paged = { pageSize };
    }

    const { searchEntries } = await client.search(config.baseDn, searchOptions);
    return searchEntries;
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : typeof error === "string"
          ? error
          : "Unknown LDAP error";
    throw new LdapServiceError(`LDAP sync failed: ${message}`);
  } finally {
    await safeUnbind(client);
  }
};

export const createLdapService = (config) => ({
  authenticate: (credentials) => authenticateLdapUser(config, credentials),
  searchEntries: (options) => searchLdapEntries(config, options)
});

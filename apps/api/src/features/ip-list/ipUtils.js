const IPV4_BITS = 32n;
const MAX_IPV4 = (1n << IPV4_BITS) - 1n;

export const normalizeIpv4Address = (value) => {
  const input = String(value ?? "").trim();
  const parts = input.split(".");
  if (parts.length !== 4) {
    throwInvalidIp(input);
  }

  const octets = parts.map((part) => {
    if (!/^\d+$/.test(part)) {
      throwInvalidIp(input);
    }
    const octet = Number(part);
    if (!Number.isInteger(octet) || octet < 0 || octet > 255) {
      throwInvalidIp(input);
    }
    return octet;
  });

  return octets.join(".");
};

export const parseIpv4Address = (value) => {
  const normalized = normalizeIpv4Address(value);
  return normalized
    .split(".")
    .map((part) => BigInt(Number(part)))
    .reduce((acc, octet) => (acc << 8n) + octet, 0n);
};

export const ipv4IntToAddress = (value) => {
  const intValue = BigInt(value);
  if (intValue < 0n || intValue > MAX_IPV4) {
    throwInvalidIp(String(value));
  }
  return [
    Number((intValue >> 24n) & 255n),
    Number((intValue >> 16n) & 255n),
    Number((intValue >> 8n) & 255n),
    Number(intValue & 255n)
  ].join(".");
};

export const parseIpv4Cidr = (value) => {
  const input = String(value ?? "").trim();
  const [addressPart, prefixPart] = input.split("/");
  if (!addressPart || !prefixPart || input.split("/").length !== 2) {
    throwInvalidCidr(input);
  }

  const prefixLength = Number(prefixPart);
  if (!Number.isInteger(prefixLength) || prefixLength < 0 || prefixLength > 32) {
    throwInvalidCidr(input);
  }

  const ipInt = parseIpv4Address(addressPart);
  const hostBits = IPV4_BITS - BigInt(prefixLength);
  const hostMask = hostBits === 0n ? 0n : (1n << hostBits) - 1n;
  const rangeStart = ipInt & (MAX_IPV4 ^ hostMask);
  const rangeEnd = rangeStart | hostMask;
  const networkAddress = ipv4IntToAddress(rangeStart);

  return {
    cidr: `${networkAddress}/${prefixLength}`,
    networkAddress,
    prefixLength,
    rangeStart,
    rangeEnd
  };
};

export const findMatchingSubnet = (ipAddress, subnetRules = []) => {
  const ipInt = typeof ipAddress === "bigint" ? ipAddress : parseIpv4Address(ipAddress);
  return subnetRules
    .filter((rule) => BigInt(rule.rangeStart) <= ipInt && ipInt <= BigInt(rule.rangeEnd))
    .sort((a, b) => Number(b.prefixLength) - Number(a.prefixLength))[0] ?? null;
};

export const getHostNumber = (ipAddress) => Number(parseIpv4Address(ipAddress) & 255n);

const throwInvalidIp = (value) => {
  const error = new Error(`Invalid IPv4 address: ${value}`);
  error.statusCode = 400;
  throw error;
};

const throwInvalidCidr = (value) => {
  const error = new Error(`Invalid IPv4 CIDR: ${value}`);
  error.statusCode = 400;
  throw error;
};

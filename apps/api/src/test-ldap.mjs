import { Client } from "ldapts";
import fs from "node:fs";

const testUsername = "haziq.afendi";
const testPassword = process.argv[2]; // Password can be passed as command line argument

// Read environment variables
const config = {
  url: process.env.LDAP_URL,
  baseDn: process.env.LDAP_BASE_DN,
  bindDn: process.env.LDAP_BIND_DN,
  bindPassword: process.env.LDAP_BIND_PASSWORD,
  userFilter: process.env.LDAP_USER_FILTER,
  useStartTls: process.env.LDAP_USE_STARTTLS === "true",
  tlsCaPath: process.env.LDAP_TLS_CA_PATH,
  rejectUnauthorized: process.env.LDAP_REJECT_UNAUTHORIZED !== "false"
};

console.log("=".repeat(60));
console.log("LDAP DEBUG SCRIPT");
console.log("=".repeat(60));
console.log("\n📋 Configuration:");
console.log(`  URL: ${config.url}`);
console.log(`  Base DN: ${config.baseDn}`);
console.log(`  Bind DN: ${config.bindDn}`);
console.log(`  User Filter Template: ${config.userFilter}`);
console.log(`  Use StartTLS: ${config.useStartTls}`);
console.log(`  Reject Unauthorized: ${config.rejectUnauthorized}`);
console.log(`  Username to test: ${testUsername}`);
console.log(`  Password provided: ${testPassword ? "Yes (hidden)" : "No"}`);

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

const buildTlsOptions = () => {
  const options = {};
  if (config.tlsCaPath) {
    try {
      options.ca = [fs.readFileSync(config.tlsCaPath)];
      console.log("  TLS CA: Loaded from file");
    } catch (err) {
      console.log(`  ⚠️  Warning: Could not load TLS CA file: ${err.message}`);
    }
  }
  options.rejectUnauthorized = config.rejectUnauthorized;
  return options;
};

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function testConnection() {
  console.log("\n" + "=".repeat(60));
  console.log("STEP 1: Testing LDAP Connection");
  console.log("=".repeat(60));

  const tlsOptions = buildTlsOptions();
  
  const client = new Client({
    url: config.url,
    timeout: 30000,
    connectTimeout: 10000,
    tlsOptions
  });

  try {
    console.log("\n📡 Connecting to LDAP server...");
    
    // Test 1: StartTLS if enabled
    if (config.useStartTls) {
      console.log("🔐 Starting TLS...");
      await client.startTLS(tlsOptions ?? {});
      console.log("✅ StartTLS completed");
    }

    // Test 2: Bind with service account
    console.log("🔑 Binding with service account...");
    console.log(`   Bind DN: ${config.bindDn}`);
    await client.bind(config.bindDn, config.bindPassword);
    console.log("✅ Service account bind successful!");

    return client;
  } catch (error) {
    console.log("\n❌ CONNECTION/BIND FAILED");
    console.log(`   Error Code: ${error.code || 'N/A'}`);
    console.log(`   Error Name: ${error.name || 'N/A'}`);
    console.log(`   Error Message: ${error.message || 'N/A'}`);
    
    if (error.code === 49) {
      console.log("\n   💡 This is an 'Invalid Credentials' error for the SERVICE ACCOUNT");
      console.log("   Common causes:");
      console.log("   - Wrong bind DN format (try 'CN=' instead of 'cn=')");
      console.log("   - Wrong password");
      console.log("   - Account locked or disabled");
    }
    
    if (error.code === "ECONNREFUSED") {
      console.log("\n   💡 Connection refused - check if the server is running and accessible");
    }
    
    if (error.code === "ETIMEDOUT" || error.code === "TIMEOUT") {
      console.log("\n   💡 Connection timed out - check network/firewall settings");
    }
    
    throw error;
  }
}

async function testUserSearch(client) {
  console.log("\n" + "=".repeat(60));
  console.log("STEP 2: Testing User Search");
  console.log("=".repeat(60));

  // Test with current filter
  const filter = buildUserFilter(config.userFilter, testUsername);
  console.log(`\n🔍 Searching with filter: ${filter}`);
  console.log(`   Base DN: ${config.baseDn}`);
  console.log(`   Scope: sub`);

  try {
    const { searchEntries } = await client.search(config.baseDn, {
      scope: "sub",
      filter,
      attributes: ["dn", "cn", "mail", "uid", "sAMAccountName", "givenName", "sn", "objectClass"]
    });

    console.log(`\n📊 Search Results: ${searchEntries.length} entries found`);

    if (searchEntries.length === 0) {
      console.log("\n⚠️  NO USER FOUND with current filter!");
      console.log("\n   Trying alternative filters...\n");
      
      // Try alternative filters
      const alternativeFilters = [
        `(uid=${escapeLdapFilter(testUsername)})`,
        `(cn=${escapeLdapFilter(testUsername)})`,
        `(mail=${escapeLdapFilter(testUsername)})`,
        `(sAMAccountName=${escapeLdapFilter(testUsername)})`
      ];

      for (const altFilter of alternativeFilters) {
        console.log(`   Trying filter: ${altFilter}`);
        try {
          const altResult = await client.search(config.baseDn, {
            scope: "sub",
            filter: altFilter,
            attributes: ["dn", "cn", "mail", "uid", "sAMAccountName"]
          });
          
          if (altResult.searchEntries.length > 0) {
            console.log(`   ✅ Found ${altResult.searchEntries.length} entries with this filter!`);
            altResult.searchEntries.forEach((entry, idx) => {
              console.log(`\n   Entry ${idx + 1}:`);
              console.log(`     DN: ${entry.dn}`);
              console.log(`     CN: ${entry.cn || 'N/A'}`);
              console.log(`     UID: ${entry.uid || 'N/A'}`);
              console.log(`     sAMAccountName: ${entry.sAMAccountName || 'N/A'}`);
              console.log(`     Mail: ${entry.mail || 'N/A'}`);
            });
          } else {
            console.log(`   ❌ No results`);
          }
        } catch (err) {
          console.log(`   ❌ Error: ${err.message}`);
        }
      }
      
      return null;
    }

    // Show found entries
    searchEntries.forEach((entry, idx) => {
      console.log(`\n📄 Entry ${idx + 1}:`);
      console.log(`   DN: ${entry.dn}`);
      console.log(`   CN: ${entry.cn || 'N/A'}`);
      console.log(`   UID: ${entry.uid || 'N/A'}`);
      console.log(`   sAMAccountName: ${entry.sAMAccountName || 'N/A'}`);
      console.log(`   Mail: ${entry.mail || 'N/A'}`);
      console.log(`   GivenName: ${entry.givenName || 'N/A'}`);
      console.log(`   SN: ${entry.sn || 'N/A'}`);
      console.log(`   ObjectClass: ${Array.isArray(entry.objectClass) ? entry.objectClass.join(', ') : entry.objectClass || 'N/A'}`);
    });

    return searchEntries[0];

  } catch (error) {
    console.log("\n❌ SEARCH FAILED");
    console.log(`   Error: ${error.message}`);
    throw error;
  }
}

async function testUserAuthentication(entry) {
  console.log("\n" + "=".repeat(60));
  console.log("STEP 3: Testing User Authentication");
  console.log("=".repeat(60));

  if (!entry) {
    console.log("\n⚠️  Skipping authentication test - no user entry found");
    return false;
  }

  if (!testPassword) {
    console.log("\n⚠️  Skipping authentication test - no password provided");
    console.log("   Run with: node --env-file=.env apps/api/src/test-ldap.mjs <password>");
    return false;
  }

  const tlsOptions = buildTlsOptions();
  const client = new Client({
    url: config.url,
    timeout: 30000,
    connectTimeout: 10000,
    tlsOptions
  });

  try {
    console.log(`\n🔐 Attempting to bind as user:`);
    console.log(`   DN: ${entry.dn}`);
    console.log(`   Password: **** (hidden)`);

    if (config.useStartTls) {
      await client.startTLS(tlsOptions ?? {});
    }

    await client.bind(entry.dn, testPassword);
    console.log("\n✅ USER AUTHENTICATION SUCCESSFUL!");
    return true;

  } catch (error) {
    console.log("\n❌ USER AUTHENTICATION FAILED");
    console.log(`   Error Code: ${error.code || 'N/A'}`);
    console.log(`   Error Name: ${error.name || 'N/A'}`);
    console.log(`   Error Message: ${error.message || 'N/A'}`);
    
    if (error.code === 49) {
      console.log("\n   💡 This is an 'Invalid Credentials' error");
      console.log("   Common causes:");
      console.log("   - Wrong password");
      console.log("   - User account locked or disabled");
      console.log("   - Password expired");
      console.log("   - Account requires password change at next logon");
    }
    
    return false;
  } finally {
    try {
      await client.unbind();
    } catch {
      // ignore
    }
  }
}

async function runTests() {
  let client = null;
  let entry = null;
  let authSuccess = false;

  try {
    // Test 1: Connection
    client = await testConnection();
    
    // Test 2: User Search
    entry = await testUserSearch(client);
    
    // Test 3: User Authentication (if we have a password and found a user)
    if (entry && testPassword) {
      authSuccess = await testUserAuthentication(entry);
    }

  } catch (error) {
    console.log("\n" + "=".repeat(60));
    console.log("❌ OVERALL TEST FAILED");
    console.log("=".repeat(60));
    console.log(`\nError: ${error.message}`);
    if (error.stack) {
      console.log("\nStack trace:");
      console.log(error.stack);
    }
    process.exit(1);
  } finally {
    if (client) {
      try {
        await client.unbind();
      } catch {
        // ignore
      }
    }
  }

  // Summary
  console.log("\n" + "=".repeat(60));
  console.log("📊 TEST SUMMARY");
  console.log("=".repeat(60));
  console.log(`\n✅ LDAP Connection: SUCCESS`);
  console.log(`✅ Service Account Bind: SUCCESS`);
  console.log(`${entry ? '✅' : '❌'} User Search: ${entry ? 'SUCCESS' : 'FAILED'}`);
  if (entry) {
    console.log(`   Found DN: ${entry.dn}`);
    console.log(`   sAMAccountName: ${entry.sAMAccountName || 'N/A'}`);
    console.log(`   UID: ${entry.uid || 'N/A'}`);
  }
  
  if (testPassword) {
    console.log(`${authSuccess ? '✅' : '❌'} User Authentication: ${authSuccess ? 'SUCCESS' : 'FAILED'}`);
  } else {
    console.log(`⏭️  User Authentication: SKIPPED (no password provided)`);
  }

  // Recommendations
  console.log("\n" + "=".repeat(60));
  console.log("💡 RECOMMENDATIONS");
  console.log("=".repeat(60));
  
  if (!entry) {
    console.log("\n1. The user search returned no results. Check:");
    console.log("   - Is the LDAP_USER_FILTER correct?");
    console.log("   - Try using 'uid' instead of 'sAMAccountName' in the filter");
    console.log("   - Check if the username format is correct (e.g., 'haziq.afendi' vs 'hafendi')");
    console.log("   - Verify the LDAP_BASE_DN is correct");
  }
  
  if (entry && !authSuccess && testPassword) {
    console.log("\n1. The user was found but authentication failed. Check:");
    console.log("   - Is the password correct?");
    console.log("   - Is the user account locked or disabled in Active Directory?");
    console.log("   - Has the password expired?");
    console.log("   - Try logging into another system with the same credentials");
  }

  if (entry && entry.sAMAccountName && config.userFilter.includes("sAMAccountName")) {
    console.log("\n2. The sAMAccountName attribute IS available on the user entry.");
    console.log("   This means the filter should work if the value matches.");
  } else if (entry && !entry.sAMAccountName && config.userFilter.includes("sAMAccountName")) {
    console.log("\n⚠️  ALERT: The user entry does NOT have sAMAccountName attribute!");
    console.log("   You should change LDAP_USER_FILTER to use 'uid' or another attribute");
    console.log(`   Current filter: ${config.userFilter}`);
    console.log(`   Suggested filter: (uid={{username}})`);
  }

  console.log("\n" + "=".repeat(60));
  console.log("LDAP DEBUG COMPLETE");
  console.log("=".repeat(60));
}

runTests();

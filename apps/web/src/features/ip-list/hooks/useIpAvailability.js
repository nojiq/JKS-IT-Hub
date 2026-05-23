import { useQuery } from "@tanstack/react-query";
import { useDebounce } from "../../../shared/hooks/useDebounce.js";
import { fetchIpDetail } from "../api/ipListApi.js";
import { isValidIpv4 } from "../utils/ipListDisplay.js";

/**
 * Probes whether an IPv4 is already registered (asset or manual).
 * 200 = taken, 404 = available.
 */
export function useIpAvailability(ipAddress, { enabled = true } = {}) {
  const debounced = useDebounce((ipAddress ?? "").trim(), 400);
  const valid = enabled && isValidIpv4(debounced);

  const query = useQuery({
    queryKey: ["ip-list", "probe", debounced],
    queryFn: async () => {
      try {
        const data = await fetchIpDetail(debounced);
        return { status: "taken", record: data };
      } catch (error) {
        if (error.status === 404) {
          return { status: "available", record: null };
        }
        throw error;
      }
    },
    enabled: valid,
    retry: false,
    staleTime: 30_000
  });

  if (!valid) {
    return {
      status: "idle",
      record: null,
      isChecking: false,
      error: null
    };
  }

  if (query.isLoading || query.isFetching) {
    return {
      status: "checking",
      record: null,
      isChecking: true,
      error: null
    };
  }

  if (query.error) {
    return {
      status: "error",
      record: null,
      isChecking: false,
      error: query.error
    };
  }

  return {
    status: query.data?.status ?? "idle",
    record: query.data?.record ?? null,
    isChecking: false,
    error: null
  };
}

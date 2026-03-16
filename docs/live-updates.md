# Live Status Updates Documentation

## Overview

The IT-Hub application uses Server-Sent Events (SSE) to provide real-time status updates for requests and maintenance windows without requiring manual page refreshes. This document covers the SSE implementation, event types, and integration patterns.

## Architecture

### Technology Stack
- **Backend**: Fastify with `fastify-sse-v2` (v4.2.1)
- **Frontend**: React with EventSource API
- **Authentication**: JWT cookies (same auth as REST APIs)
- **Transport**: Server-Sent Events (SSE) over HTTP

### Why SSE Instead of WebSockets?
- **Simpler**: One-way server-to-client communication (no client-to-server messages needed)
- **Resilient reconnect**: Client retries with managed exponential backoff
- **HTTP-based**: Works through standard HTTP infrastructure (proxies, load balancers)
- **Secure**: Uses same authentication as existing API endpoints

## SSE Endpoint

### Connection Endpoint
```
GET /api/v1/sse/stream
```

**Authentication**: Required (JWT cookie)  
**Response Type**: `text/event-stream`  
**Headers**:
- `Content-Type: text/event-stream`
- `Cache-Control: no-cache`
- `Connection: keep-alive`

### Connection Lifecycle
1. **Connect**: Client opens EventSource connection
2. **Authenticate**: Server validates JWT token
3. **Heartbeat**: Server sends heartbeat every 30 seconds (`:heartbeat\n\n`)
4. **Events**: Server pushes events as they occur
5. **Disconnect**: Automatic cleanup when client disconnects

### Reconnection
- **Auto-reconnect**: Client retries on connection loss
- **Exponential backoff**: 5s → 10s → 20s → max 60s between retries
- **Connection indicator**: UI shows connection status

## Event Types

All events follow a standard payload format:
```javascript
{
  id: string,          // Unique event ID (UUID)
  type: string,        // Event type (e.g., 'request.updated')
  timestamp: string,   // ISO 8601 UTC timestamp
  data: {...}          // Event-specific data
}
```

### Request Events

#### `request.created`
Emitted when a new request is submitted.

**Recipients**: IT staff, Requesters  
**Payload**:
```javascript
{
  requestId: string,
  itemName: string,
  status: string,
  priority: string,
  createdAt: string,
  requesterName: string
}
```

#### `request.updated`
Emitted when request details are modified.

**Recipients**: Requester, IT staff  
**Payload**:
```javascript
{
  requestId: string,
  updatedAt: string,
  actorName: string
}
```

#### `request.status_changed`
Emitted as the canonical status transition event (SUBMITTED → IT_REVIEWED → APPROVED, etc.).

**Recipients**: Requester, IT staff  
**Payload**:
```javascript
{
  requestId: string,
  newStatus: string,
  previousStatus: string,
  updatedAt: string,
  actorName: string,
  itemName: string
}
```

#### `request.reviewed` / `request.approved` / `request.rejected`
Status-specific aliases emitted alongside `request.status_changed` for targeted subscriptions.

### Maintenance Events

#### `maintenance.updated`
Emitted when maintenance window status changes.

**Recipients**: Assigned technician(s), IT/Admin/Head users  
**Payload**:
```javascript
{
  maintenanceId: string,
  scheduleId: string,
  newStatus: string,
  previousStatus: string,
  scheduledDate: string,
  description: string,
  updatedAt: string,
  actorName: string
}
```

#### `maintenance.completed`
Emitted when maintenance window is signed off.

**Recipients**: Assigned technician(s), IT/Admin/Head users  
**Payload**:
```javascript
{
  maintenanceId: string,
  completedAt: string,
  technicianName: string,
  remarks: string
}
```

## Frontend Integration

### Using the SSE Hook

The `useSSE` hook subscribes to specific event types:

```javascript
import { useSSE } from '@/shared/hooks/useSSE';
import { useQueryClient } from '@tanstack/react-query';

function MyComponent() {
    const queryClient = useQueryClient();
    
    const handleRequestUpdate = useCallback((data) => {
        // Invalidate queries to refetch fresh data
        queryClient.invalidateQueries({ queryKey: ['requests'] });
        
        // Optionally show toast notification
        if (data.newStatus === 'APPROVED') {
            toast.success('Request Approved!');
        }
    }, [queryClient]);
    
    // Subscribe to events
    useSSE('request.approved', handleRequestUpdate);
}
```

### Toast Notifications

Show user-friendly notifications for important events:

```javascript
import { useToast } from '@/shared/hooks/useToast';

const toast = useToast();

// Show success toast
toast.success('Title', 'Message', duration);

// Show error toast
toast.error('Title', 'Message');

// Show warning toast
toast.warning('Title', 'Message');

// Show info toast
toast.info('Title', 'Message');
```

### Connection Status

The `ConnectionStatus` component automatically displays connection state:
- **Green dot**: Connected
- **Yellow dot**: Reconnecting...
- **Red dot**: Disconnected

It auto-hides after 2 seconds when connected.

## Backend Integration

### Emitting Events

Use the event helpers in feature modules:

#### Request Events
```javascript
import { emitRequestStatusChanged } from './requests/events.js';

// In service function after status update
await requestRepo.updateRequest(id, { status: 'APPROVED' });
emitRequestStatusChanged(updatedRequest, previousStatus, actor);
```

#### Maintenance Events
```javascript
import { emitMaintenanceCompleted } from './maintenance/events.js';

// After maintenance completion
await maintenanceRepo.markCompleted(id, data);
emitMaintenanceCompleted(window, actor);
```

### Role-Based Filtering

Events are automatically filtered based on user roles:

```javascript
import { emitToUser, emitToITStaff, emitToRole } from './notifications/sseHandler.js';

// Emit to specific user
emitToUser(userId, { type: 'request.updated', data: {...} });

// Emit to all IT staff (IT, Admin, Head IT)
emitToITStaff({ type: 'request.created', data: {...} });

// Emit to specific role
emitMaintenanceCompleted(window, actorUser);

// Emit to all connected users
emitToAll({ type: 'system.announcement', data: {...} });
```

## Performance Considerations

### Connection Management
- Each user can have multiple connections (multiple tabs/windows)
- Connections are stored in `Map<userId, Set<response>>` for efficient lookup
- Automatic cleanup on disconnect prevents memory leaks

### Event Delivery
- **Fire-and-forget**: Events don't block main workflow
- **Error handling**: Failed deliveries are logged but don't throw errors
- **No acknowledgment**: SSE is one-way (server → client)

### Scalability
- SSE is stateful (one connection per client)
- For horizontal scaling, consider sticky sessions or Redis pub/sub
- Current implementation: in-memory (single server)

## Troubleshooting

### Issue: SSE Connection Fails

**Symptoms**: Red "Disconnected" indicator  
**Causes**:
1. Authentication failure (expired JWT)
2. Network issues
3. Server restart

**Solutions**:
- Check JWT cookie validity
- Verify network connectivity
- Client retry flow will reconnect automatically (check connection indicator)

### Issue: Events Not Received

**Checklist**:
1. ✅ SSE connection established (check browser dev tools → Network → sse/stream)
2. ✅ User has permission to receive event (role-based filtering)
3. ✅ Event type subscribed via `useSSE` hook
4. ✅ Backend emitting events correctly

### Issue: Multiple Toast Notifications

**Cause**: Registering SSE listeners multiple times (re-renders)  
**Solution**: Use `useCallback` for event handlers:

```javascript
const handleEvent = useCallback((data) => {
    // handler logic
}, [dependencies]);

useSSE('event.type', handleEvent);
```

## Security Considerations

1. **Authentication Required**: SSE endpoint requires valid JWT
2. **Role-Based Filtering**: Users only receive events they're authorized for
3. **No Sensitive Data**: Avoid including passwords/secrets in payloads
4. **Audit Logging**: Event emissions don't create duplicate audit entries (original action is already logged)

## Testing

### Manual Testing
1. Open application in two browser windows
2. Perform an action in one window (e.g., approve request)
3. Verify other window updates within 5 seconds
4. Check toast notification appears

### Automated Testing
See `tests/api/sse.test.mjs` for SSE endpoint tests.

## References

- [MDN: Server-Sent Events](https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events)
- [fastify-sse-v2 Documentation](https://github.com/NodeFactoryIo/fastify-sse-v2)
- [EventSource API](https://developer.mozilla.org/en-US/docs/Web/API/EventSource)

---

**Last Updated**: 2026-02-09  
**Maintained by**: IT-Hub Development Team

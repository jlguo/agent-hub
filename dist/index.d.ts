import { Server } from 'socket.io';
import { PrismaClient } from '@prisma/client';
export declare const prisma: PrismaClient<{
    datasourceUrl: string | undefined;
}, never, import("@prisma/client/runtime/library.js").DefaultArgs>;
declare const io: Server<import("socket.io").DefaultEventsMap, import("socket.io").DefaultEventsMap, import("socket.io").DefaultEventsMap, any>;
export { io };
//# sourceMappingURL=index.d.ts.map
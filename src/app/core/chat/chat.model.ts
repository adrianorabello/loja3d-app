export interface ChatPage<T>
{
    items: T[];
    hasMore: boolean;
    nextCursor: string | number | null;
}

export interface ChatConversation
{
    id: string;
    customerName: string;
    lastSeq: number;
    lastReadSeq: number;
    preview: string;
    updatedAt: string;
    unread: number;
}

export interface ChatAttachment
{
    id: string;
    name: string;
    contentType: string;
    size: number;
    status: 'uploading' | 'quarantined' | 'ready' | 'rejected' | 'attached' | 'cancelled';
    error?: string;
}

export interface ChatMessage
{
    id: string;
    conversationId: string;
    seq: number;
    clientMessageId: string;
    sender: {id: string; name: string; role: string};
    text: string;
    createdAt: string;
    attachments: ChatAttachment[];
}

export interface ChatEvent
{
    v: number;
    type: string;
    conversationId?: string;
    eventId?: string;
    seq?: number;
}

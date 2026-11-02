export const REQUEST_STATUSES = [
    'submitted', 'under_review', 'information_required', 'awaiting_quote_approval',
    'quote_changes_requested', 'awaiting_payment', 'payment_verification', 'payment_confirmed',
    'in_production', 'production_paused', 'shipped', 'delivered', 'rejected', 'cancelled'
] as const;

export type RequestStatus = typeof REQUEST_STATUSES[number];
export type RequestAction = 'approve_quote' | 'request_changes' | 'cancel';

export interface PrintQuote
{
    version: number;
    amountCents: number;
    currency: 'EUR';
    scope: string;
    leadDays: number;
    validUntil: string;
    createdAt: string;
    approvedAt?: string;
}

export interface RequestHistory
{
    id: string;
    kind: string;
    actorRole: 'customer' | 'admin';
    actorName: string;
    message: string;
    status: RequestStatus;
    createdAt: string;
}

export interface PrintRequest
{
    id: string;
    reference: string;
    ownerId: string;
    customerName: string;
    customerEmail: string;
    title: string;
    description: string;
    quantity: number;
    dimensions: string;
    material: string;
    color: string;
    referenceLinks: string[];
    status: RequestStatus;
    version: number;
    createdAt: string;
    updatedAt: string;
    quotes: PrintQuote[];
    history: RequestHistory[];
    trackingUrl?: string;
    estimatedShipping?: string;
    allowedTransitions: RequestStatus[];
    allowedActions: RequestAction[];
}

export interface CreatePrintRequest
{
    title: string;
    description: string;
    quantity: number;
    dimensions: string;
    material: string;
    color: string;
    referenceLinks: string[];
}

export interface PrintRequestPage
{
    items: PrintRequest[];
    total: number;
    page: number;
    pageSize: number;
}

export interface RequestQuery
{
    page: number;
    pageSize: number;
    q: string;
    status: string;
    sort: 'newest' | 'oldest';
}

export interface PublishQuote
{
    version: number;
    amountCents: number;
    currency: 'EUR';
    scope: string;
    leadDays: number;
    validUntil: string;
}

export interface RequestTransition
{
    version: number;
    status: RequestStatus;
    message: string;
    trackingUrl?: string;
    estimatedShipping?: string;
}

export const REQUEST_STAGES = ['request', 'quote', 'payment', 'production', 'shipping', 'delivery'];

export function requestStage(status: RequestStatus): number
{
    if ( ['awaiting_quote_approval', 'quote_changes_requested'].includes(status) ) { return 1; }
    if ( ['awaiting_payment', 'payment_verification', 'payment_confirmed'].includes(status) ) { return 2; }
    if ( ['in_production', 'production_paused'].includes(status) ) { return 3; }
    if ( status === 'shipped' ) { return 4; }
    if ( status === 'delivered' ) { return 5; }

    return 0;
}

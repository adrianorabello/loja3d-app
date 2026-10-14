export type Layout =
    | 'empty'
    // Clara Rosa — public storefront shell (header + footer, no admin chrome,
    // and deliberately no InitialDataResolver dependency)
    | 'storefront'
    // Horizontal
    | 'centered'
    | 'enterprise'
    | 'material'
    | 'modern'
    // Vertical
    | 'classic'
    | 'classy'
    | 'compact'
    | 'dense'
    | 'futuristic'
    | 'thin';

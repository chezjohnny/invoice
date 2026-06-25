export type Locale = 'en' | 'fr';

const EN = {
  nav: {
    dashboard: 'Dashboard', articles: 'Articles', customers: 'Customers',
    invoices: 'Invoices', signOut: 'Sign out',
  },
  dashboard: {
    title: 'Dashboard', draft: 'Draft', outstanding: 'Outstanding',
    paidThisYear: 'Paid this year', customers: 'Customers', articles: 'Articles',
    recentInvoices: 'Recent invoices', noInvoices: 'No invoices yet.',
    invoices: 'invoices', total: 'Total',
  },
  articles: {
    title: 'Articles', new: 'New article', search: 'Search articles…',
    name: 'Name', description: 'Description', unitPrice: 'Unit price',
    vatOverride: 'VAT override', stock: 'Stock', noResults: 'No articles found.',
    nameLabel: 'Name *', descLabel: 'Description', priceLabel: 'Unit price (CHF) *',
    vatLabel: 'VAT override (%)', stockLabel: 'Stock quantity',
    nameRequired: 'Name is required', priceRequired: 'Required', pricePositive: 'Must be positive',
    editTitle: 'Edit article', newTitle: 'New article',
  },
  customers: {
    title: 'Customers', new: 'New customer', search: 'Search customers…',
    exportCsv: 'Export CSV', name: 'Name', email: 'Email', city: 'City',
    noResults: 'No customers found.',
    firstNameLabel: 'First name *', lastNameLabel: 'Last name *', emailLabel: 'Email',
    addressLabel: 'Address', postalLabel: 'Postal code', cityLabel: 'City',
    countryLabel: 'Country', phonesLabel: 'Phones', addPhone: '+ Add phone',
    firstNameRequired: 'First name is required', lastNameRequired: 'Last name is required',
    invalidEmail: 'Invalid email',
    editTitle: 'Edit customer', newTitle: 'New customer',
  },
  invoices: {
    title: 'Invoices', new: 'New invoice', number: 'Number', customer: 'Customer',
    date: 'Date', due: 'Due', total: 'Total', status: 'Status',
    noResults: 'No invoices found.',
    issue: 'Issue', pay: 'Pay', pdf: 'PDF',
    customerLabel: 'Customer *', customerRequired: 'Customer is required',
    discountLabel: 'Discount (%)',
    linesLabel: 'Lines', noLines: 'No lines yet.', addLine: '+ Add line',
    notesLabel: 'Notes', saveDraft: 'Save draft',
    articleLabel: 'Article', descLabel: 'Description', qtyLabel: 'Qty',
    priceLabel: 'Price', vatLabel: 'VAT %',
    editTitle: 'Edit invoice', newTitle: 'New invoice',
  },
  status: {
    all: 'All', draft: 'Draft', issued: 'Issued', paid: 'Paid', cancelled: 'Cancelled',
  },
  common: {
    save: 'Save', cancel: 'Cancel', edit: 'Edit', archive: 'Archive', app: 'Invoice',
    loading: 'Loading…', results: 'results', searchCustomer: 'Search customer…',
  },
  login: {
    subtitle: 'Sign in to your account', email: 'Email',
    password: 'Password', signIn: 'Sign in', invalid: 'Invalid email or password.',
  },
};

const FR: typeof EN = {
  nav: {
    dashboard: 'Tableau de bord', articles: 'Articles', customers: 'Clients',
    invoices: 'Factures', signOut: 'Déconnexion',
  },
  dashboard: {
    title: 'Tableau de bord', draft: 'Brouillons', outstanding: 'En attente',
    paidThisYear: 'Payées cette année', customers: 'Clients', articles: 'Articles',
    recentInvoices: 'Factures récentes', noInvoices: 'Aucune facture.',
    invoices: 'factures', total: 'Total',
  },
  articles: {
    title: 'Articles', new: 'Nouvel article', search: 'Rechercher des articles…',
    name: 'Nom', description: 'Description', unitPrice: 'Prix unitaire',
    vatOverride: 'TVA spécifique', stock: 'Stock', noResults: 'Aucun article.',
    nameLabel: 'Nom *', descLabel: 'Description', priceLabel: 'Prix unitaire (CHF) *',
    vatLabel: 'TVA spécifique (%)', stockLabel: 'Quantité en stock',
    nameRequired: 'Le nom est requis', priceRequired: 'Requis', pricePositive: 'Doit être positif',
    editTitle: 'Modifier l\'article', newTitle: 'Nouvel article',
  },
  customers: {
    title: 'Clients', new: 'Nouveau client', search: 'Rechercher des clients…',
    exportCsv: 'Exporter CSV', name: 'Nom', email: 'E-mail', city: 'Ville',
    noResults: 'Aucun client.',
    firstNameLabel: 'Prénom *', lastNameLabel: 'Nom *', emailLabel: 'E-mail',
    addressLabel: 'Adresse', postalLabel: 'Code postal', cityLabel: 'Ville',
    countryLabel: 'Pays', phonesLabel: 'Téléphones', addPhone: '+ Ajouter un téléphone',
    firstNameRequired: 'Le prénom est requis', lastNameRequired: 'Le nom est requis',
    invalidEmail: 'E-mail invalide',
    editTitle: 'Modifier le client', newTitle: 'Nouveau client',
  },
  invoices: {
    title: 'Factures', new: 'Nouvelle facture', number: 'Numéro', customer: 'Client',
    date: 'Date', due: 'Échéance', total: 'Total', status: 'Statut',
    noResults: 'Aucune facture.',
    issue: 'Émettre', pay: 'Payer', pdf: 'PDF',
    customerLabel: 'Client *', customerRequired: 'Le client est requis',
    discountLabel: 'Remise (%)',
    linesLabel: 'Lignes', noLines: 'Aucune ligne.', addLine: '+ Ajouter une ligne',
    notesLabel: 'Notes', saveDraft: 'Enregistrer',
    articleLabel: 'Article', descLabel: 'Description', qtyLabel: 'Qté',
    priceLabel: 'Prix', vatLabel: 'TVA %',
    editTitle: 'Modifier la facture', newTitle: 'Nouvelle facture',
  },
  status: {
    all: 'Tout', draft: 'Brouillon', issued: 'Émise', paid: 'Payée', cancelled: 'Annulée',
  },
  common: {
    save: 'Enregistrer', cancel: 'Annuler', edit: 'Modifier', archive: 'Archiver', app: 'Factures',
    loading: 'Chargement…', results: 'résultats', searchCustomer: 'Rechercher un client…',
  },
  login: {
    subtitle: 'Connectez-vous à votre compte', email: 'E-mail',
    password: 'Mot de passe', signIn: 'Connexion', invalid: 'E-mail ou mot de passe invalide.',
  },
};

export const TRANSLATIONS: Record<Locale, typeof EN> = { en: EN, fr: FR };
export type Translations = typeof EN;

export type LanguageCode = 'en' | 'pt-BR' | 'es' | 'fr' | 'de';

export const LANGUAGE_NAMES: Record<LanguageCode, string> = {
  en: 'English',
  'pt-BR': 'Português (Brasil)',
  es: 'Español',
  fr: 'Français',
  de: 'Deutsch',
};

export interface Translation {
  // General
  cancel: string;
  create: string;
  update: string;
  delete: string;
  edit: string;
  close: string;
  done: string;
  saveChanges: string;
  
  // Header
  appName: string;
  addTrack: string;
  editGrid: string;
  
  // Sidebar
  performance: string;
  dailyGroove: string;
  currentStreak: string;
  days: string;
  completedToday: string;
  tasks: string;
  last7Days: string;
  consistencyMsg: string;
  loginSync: string;
  signedInAs: string;
  logout: string;
  
  // Empty State
  noTracks: string;
  createOne: string;
  
  // Pad Item
  viewDetails: string;
  
  // Task Modal
  newTrack: string;
  remixTrack: string;
  trackDetails: string;
  title: string;
  titlePlaceholder: string;
  details: string;
  description: string;
  descPlaceholder: string;
  editTrack: string;
  
  // Delete Modal
  deleteTrackTitle: string;
  deleteConfirm: string;
  actionUndone: string;
  
  // Login Modal
  newArtist: string;
  backstageAccess: string;
  emailOrUsername: string;
  email: string;
  password: string;
  confirmPassword: string;
  creating: string;
  authenticating: string;
  joinMix: string;
  logIn: string;
  alreadyHaveAccount: string;
  dontHaveAccount: string;
  register: string;
  passwordsMismatch: string;
  
  // Congrats
  mixComplete: string;
  clearedDeck: string;
  keepGroovin: string;
  
  // Settings
  studioSettings: string;
  lighting: string;
  language: string;
  soundEffects: string;
  selectLanguage: string;
  username: string;
  usernamePlaceholder: string;
  changesRemaining: string;
  usernameTaken: string;
  usernameInvalid: string;
}

export const translations: Record<LanguageCode, Translation> = {
  en: {
    cancel: 'Cancel',
    create: 'Create',
    update: 'Update',
    delete: 'Delete',
    edit: 'Edit',
    close: 'Close',
    done: 'Done',
    saveChanges: 'Save Changes',
    appName: 'TASK',
    addTrack: 'Add Track',
    editGrid: 'Edit Grid',
    performance: 'Performance',
    dailyGroove: 'Your daily groove statistics.',
    currentStreak: 'Current Streak',
    days: 'days',
    completedToday: 'Completed Today',
    tasks: 'tasks',
    last7Days: 'Last 7 Days Activity',
    consistencyMsg: 'Consistency is key to the rhythm of success.',
    loginSync: 'Login / Sync',
    signedInAs: 'Signed in as',
    logout: 'Log Out',
    noTracks: 'No tracks in your mix yet.',
    createOne: 'Create one now',
    viewDetails: 'View Details',
    newTrack: 'New Track',
    remixTrack: 'Remix Track',
    trackDetails: 'Track Details',
    title: 'Title',
    titlePlaceholder: 'e.g. Drink Water',
    details: 'Details',
    description: 'Description (Optional)',
    descPlaceholder: 'Add more context...',
    editTrack: 'Edit this track',
    deleteTrackTitle: 'Delete Track?',
    deleteConfirm: 'Are you sure you want to remove',
    actionUndone: 'This action cannot be undone.',
    newArtist: 'New Artist Registration',
    backstageAccess: 'Backstage Access',
    emailOrUsername: 'Email or Username',
    email: 'Email',
    password: 'Password',
    confirmPassword: 'Confirm Password',
    creating: 'Creating Account...',
    authenticating: 'Authenticating...',
    joinMix: 'Join the Mix',
    logIn: 'Log In',
    alreadyHaveAccount: 'Already have an account? ',
    dontHaveAccount: "Don't have an account? ",
    register: 'Register',
    passwordsMismatch: 'Passwords do not match',
    mixComplete: 'Mix Complete!',
    clearedDeck: "You've cleared the deck for today. Excellent rhythm.",
    keepGroovin: "Keep Groovin'",
    studioSettings: 'Studio Settings',
    lighting: 'Lighting',
    language: 'Language',
    soundEffects: 'Sound Effects',
    selectLanguage: 'Select Language',
    username: 'Artist Name (Username)',
    usernamePlaceholder: 'Enter username',
    changesRemaining: 'changes remaining',
    usernameTaken: 'Username is already taken',
    usernameInvalid: 'Invalid username (3-20 chars, no spaces)'
  },
  'pt-BR': {
    cancel: 'Cancelar',
    create: 'Criar',
    update: 'Atualizar',
    delete: 'Excluir',
    edit: 'Editar',
    close: 'Fechar',
    done: 'Pronto',
    saveChanges: 'Salvar Alterações',
    appName: 'TAREFAS',
    addTrack: 'Adicionar',
    editGrid: 'Organizar',
    performance: 'Desempenho',
    dailyGroove: 'Suas estatísticas diárias.',
    currentStreak: 'Sequência Atual',
    days: 'dias',
    completedToday: 'Completas Hoje',
    tasks: 'tarefas',
    last7Days: 'Atividade dos Últimos 7 Dias',
    consistencyMsg: 'Consistência é a chave para o ritmo do sucesso.',
    loginSync: 'Entrar / Sincronizar',
    signedInAs: 'Logado como',
    logout: 'Sair',
    noTracks: 'Nenhuma faixa no seu mix ainda.',
    createOne: 'Crie uma agora',
    viewDetails: 'Ver Detalhes',
    newTrack: 'Nova Faixa',
    remixTrack: 'Remixar Faixa',
    trackDetails: 'Detalhes da Faixa',
    title: 'Título',
    titlePlaceholder: 'ex: Beber Água',
    details: 'Detalhes',
    description: 'Descrição (Opcional)',
    descPlaceholder: 'Adicione mais contexto...',
    editTrack: 'Editar esta faixa',
    deleteTrackTitle: 'Excluir Faixa?',
    deleteConfirm: 'Tem certeza que deseja remover',
    actionUndone: 'Esta ação não pode ser desfeita.',
    newArtist: 'Registro de Novo Artista',
    backstageAccess: 'Acesso aos Bastidores',
    emailOrUsername: 'E-mail ou Usuário',
    email: 'E-mail',
    password: 'Senha',
    confirmPassword: 'Confirmar Senha',
    creating: 'Criando Conta...',
    authenticating: 'Autenticando...',
    joinMix: 'Junte-se ao Mix',
    logIn: 'Entrar',
    alreadyHaveAccount: 'Já tem uma conta? ',
    dontHaveAccount: "Não tem uma conta? ",
    register: 'Registrar',
    passwordsMismatch: 'As senhas não coincidem',
    mixComplete: 'Mix Completo!',
    clearedDeck: "Você limpou a mesa por hoje. Ritmo excelente.",
    keepGroovin: "Continue no Ritmo",
    studioSettings: 'Configurações do Estúdio',
    lighting: 'Iluminação',
    language: 'Idioma',
    soundEffects: 'Efeitos Sonoros',
    selectLanguage: 'Selecione o Idioma',
    username: 'Nome Artístico (Usuário)',
    usernamePlaceholder: 'Digite o usuário',
    changesRemaining: 'alterações restantes',
    usernameTaken: 'Nome de usuário já existe',
    usernameInvalid: 'Usuário inválido (3-20 chars, sem espaços)'
  },
  es: {
    cancel: 'Cancelar',
    create: 'Crear',
    update: 'Actualizar',
    delete: 'Eliminar',
    edit: 'Editar',
    close: 'Cerrar',
    done: 'Hecho',
    saveChanges: 'Guardar Cambios',
    appName: 'TAREAS',
    addTrack: 'Añadir',
    editGrid: 'Organizar',
    performance: 'Rendimiento',
    dailyGroove: 'Tus estadísticas diarias.',
    currentStreak: 'Racha Actual',
    days: 'días',
    completedToday: 'Completadas Hoy',
    tasks: 'tareas',
    last7Days: 'Actividad Últimos 7 Días',
    consistencyMsg: 'La consistencia es clave para el ritmo del éxito.',
    loginSync: 'Entrar / Sincronizar',
    signedInAs: 'Conectado como',
    logout: 'Cerrar Sesión',
    noTracks: 'No hay pistas en tu mezcla todavía.',
    createOne: 'Crea una ahora',
    viewDetails: 'Ver Detalles',
    newTrack: 'Nueva Pista',
    remixTrack: 'Remezclar Pista',
    trackDetails: 'Detalles de la Pista',
    title: 'Título',
    titlePlaceholder: 'ej. Beber Agua',
    details: 'Detalles',
    description: 'Descripción (Opcional)',
    descPlaceholder: 'Añade más contexto...',
    editTrack: 'Editar esta pista',
    deleteTrackTitle: '¿Eliminar Pista?',
    deleteConfirm: '¿Estás seguro de que quieres eliminar',
    actionUndone: 'Esta acción no se puede deshacer.',
    newArtist: 'Registro de Nuevo Artista',
    backstageAccess: 'Acceso Backstage',
    emailOrUsername: 'Correo o Usuario',
    email: 'Correo',
    password: 'Contraseña',
    confirmPassword: 'Confirmar Contraseña',
    creating: 'Creando Cuenta...',
    authenticating: 'Autenticando...',
    joinMix: 'Únete a la Mezcla',
    logIn: 'Entrar',
    alreadyHaveAccount: '¿Ya tienes cuenta? ',
    dontHaveAccount: "¿No tienes cuenta? ",
    register: 'Registrarse',
    passwordsMismatch: 'Las contraseñas no coinciden',
    mixComplete: '¡Mezcla Completa!',
    clearedDeck: "Has despejado la mesa por hoy. Excelente ritmo.",
    keepGroovin: "Sigue el Ritmo",
    studioSettings: 'Ajustes de Estudio',
    lighting: 'Iluminación',
    language: 'Idioma',
    soundEffects: 'Efectos de Sonido',
    selectLanguage: 'Seleccionar Idioma',
    username: 'Nombre Artístico (Usuario)',
    usernamePlaceholder: 'Ingresa usuario',
    changesRemaining: 'cambios restantes',
    usernameTaken: 'El nombre de usuario ya existe',
    usernameInvalid: 'Usuario inválido (3-20 carácteres, sin espacios)'
  },
  fr: {
    cancel: 'Annuler',
    create: 'Créer',
    update: 'Mettre à jour',
    delete: 'Supprimer',
    edit: 'Modifier',
    close: 'Fermer',
    done: 'Terminé',
    saveChanges: 'Sauvegarder',
    appName: 'TÂCHES',
    addTrack: 'Ajouter',
    editGrid: 'Organiser',
    performance: 'Performance',
    dailyGroove: 'Vos statistiques quotidiennes.',
    currentStreak: 'Série Actuelle',
    days: 'jours',
    completedToday: 'Terminé Aujourd\'hui',
    tasks: 'tâches',
    last7Days: 'Activité des 7 derniers jours',
    consistencyMsg: 'La régularité est la clé du succès.',
    loginSync: 'Connexion / Synchro',
    signedInAs: 'Connecté en tant que',
    logout: 'Déconnexion',
    noTracks: 'Aucune piste dans votre mix pour l\'instant.',
    createOne: 'Créez-en une maintenant',
    viewDetails: 'Voir Détails',
    newTrack: 'Nouvelle Piste',
    remixTrack: 'Remixer Piste',
    trackDetails: 'Détails de la Piste',
    title: 'Titre',
    titlePlaceholder: 'ex: Boire de l\'eau',
    details: 'Détails',
    description: 'Description (Optionnel)',
    descPlaceholder: 'Ajouter du contexte...',
    editTrack: 'Modifier cette piste',
    deleteTrackTitle: 'Supprimer la Piste ?',
    deleteConfirm: 'Êtes-vous sûr de vouloir supprimer',
    actionUndone: 'Cette action est irréversible.',
    newArtist: 'Inscription Nouvel Artiste',
    backstageAccess: 'Accès Coulisses',
    emailOrUsername: 'E-mail ou Nom d\'utilisateur',
    email: 'E-mail',
    password: 'Mot de passe',
    confirmPassword: 'Confirmer Mot de passe',
    creating: 'Création du compte...',
    authenticating: 'Authentification...',
    joinMix: 'Rejoindre le Mix',
    logIn: 'Se connecter',
    alreadyHaveAccount: 'Déjà un compte ? ',
    dontHaveAccount: "Pas de compte ? ",
    register: 'S\'inscrire',
    passwordsMismatch: 'Les mots de passe ne correspondent pas',
    mixComplete: 'Mix Terminé !',
    clearedDeck: "Vous avez tout terminé pour aujourd'hui. Excellent rythme.",
    keepGroovin: "Gardez le Rythme",
    studioSettings: 'Paramètres Studio',
    lighting: 'Éclairage',
    language: 'Langue',
    soundEffects: 'Effets Sonores',
    selectLanguage: 'Choisir la Langue',
    username: 'Nom de Scène (Utilisateur)',
    usernamePlaceholder: 'Entrez le nom d\'utilisateur',
    changesRemaining: 'changements restants',
    usernameTaken: 'Le nom d\'utilisateur est déjà pris',
    usernameInvalid: 'Nom d\'utilisateur invalide (3-20 caractères)'
  },
  de: {
    cancel: 'Abbrechen',
    create: 'Erstellen',
    update: 'Aktualisieren',
    delete: 'Löschen',
    edit: 'Bearbeiten',
    close: 'Schließen',
    done: 'Fertig',
    saveChanges: 'Änderungen speichern',
    appName: 'AUFGABEN',
    addTrack: 'Hinzufügen',
    editGrid: 'Ordnen',
    performance: 'Leistung',
    dailyGroove: 'Deine täglichen Groove-Statistiken.',
    currentStreak: 'Aktuelle Serie',
    days: 'Tage',
    completedToday: 'Heute erledigt',
    tasks: 'Aufgaben',
    last7Days: 'Aktivität der letzten 7 Tage',
    consistencyMsg: 'Konsistenz ist der Schlüssel zum Rhythmus des Erfolgs.',
    loginSync: 'Login / Sync',
    signedInAs: 'Angemeldet als',
    logout: 'Abmelden',
    noTracks: 'Noch keine Tracks in deinem Mix.',
    createOne: 'Erstelle jetzt einen',
    viewDetails: 'Details anzeigen',
    newTrack: 'Neuer Track',
    remixTrack: 'Track remixen',
    trackDetails: 'Track-Details',
    title: 'Titel',
    titlePlaceholder: 'z.B. Wasser trinken',
    details: 'Details',
    description: 'Beschreibung (Optional)',
    descPlaceholder: 'Mehr Kontext hinzufügen...',
    editTrack: 'Diesen Track bearbeiten',
    deleteTrackTitle: 'Track löschen?',
    deleteConfirm: 'Möchtest du wirklich entfernen:',
    actionUndone: 'Diese Aktion kann nicht rückgängig gemacht werden.',
    newArtist: 'Neue Künstlerregistrierung',
    backstageAccess: 'Backstage-Zugang',
    emailOrUsername: 'E-Mail oder Benutzername',
    email: 'E-Mail',
    password: 'Passwort',
    confirmPassword: 'Passwort bestätigen',
    creating: 'Konto wird erstellt...',
    authenticating: 'Authentifizierung...',
    joinMix: 'Dem Mix beitreten',
    logIn: 'Einloggen',
    alreadyHaveAccount: 'Hast du schon ein Konto? ',
    dontHaveAccount: "Noch kein Konto? ",
    register: 'Registrieren',
    passwordsMismatch: 'Passwörter stimmen nicht überein',
    mixComplete: 'Mix Komlett!',
    clearedDeck: "Du hast heute alles erledigt. Exzellenter Rhythmus.",
    keepGroovin: "Bleib im Groove",
    studioSettings: 'Studio-Einstellungen',
    lighting: 'Beleuchtung',
    language: 'Sprache',
    soundEffects: 'Soundeffekte',
    selectLanguage: 'Sprache auswählen',
    username: 'Künstlername (Benutzername)',
    usernamePlaceholder: 'Benutzername eingeben',
    changesRemaining: 'Änderungen verbleibend',
    usernameTaken: 'Benutzername ist bereits vergeben',
    usernameInvalid: 'Ungültiger Benutzername (3-20 Zeichen)'
  }
};
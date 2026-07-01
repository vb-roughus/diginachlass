/**
 * Inhalt des Premium-White-Papers „Digitaler Nachlass". Die Anbieter-Angaben
 * wurden anhand der offiziellen Hilfeseiten recherchiert und geprüft (Stand
 * Mitte 2026). Verfahren und Links können sich ändern — daher enthält das
 * White Paper einen entsprechenden Hinweis und verlinkt stets die offizielle
 * Quelle. `verified: false` markiert Einträge ohne bestätigtes Self-Service-
 * Formular (dort ist der allgemeine Support die Anlaufstelle).
 */

export interface GuideLink {
  label: string;
  url: string;
}

export interface GuideEntry {
  service: string;
  category: string;
  /** Wo/an wen sich Angehörige wenden. */
  contactPoint: string;
  /** Konkrete Schritte für Hinterbliebene. */
  steps: string[];
  /** Offizielle Anlaufstellen (Formulare/Hilfeseiten). */
  links: GuideLink[];
  note?: string;
  verified: boolean;
  /** Kleinbuchstaben-Stichworte zum Abgleich mit erfassten Dienstnamen. */
  match: string[];
}

export interface GeneralSection {
  title: string;
  paragraphs: string[];
}

export const DEATH_HANDLING_GUIDE: GuideEntry[] = [
  {
    service: 'Facebook',
    category: 'Social Media',
    contactPoint:
      'Angehörige können das Konto in den Gedenkzustand versetzen lassen oder dessen Löschung beantragen. Facebook prüft die Anträge manuell.',
    steps: [
      'Antrag auf Gedenkzustand über das offizielle Formular stellen und die Beziehung zur verstorbenen Person angeben.',
      'Einen Todesnachweis beifügen (z. B. Link zu Traueranzeige/Nachruf oder Sterbeurkunde) — das beschleunigt die Bearbeitung.',
      'Für eine vollständige Löschung statt Gedenkzustand ein separates Löschersuchen als unmittelbare/r Angehörige/r stellen.',
    ],
    links: [
      { label: 'Facebook: Antrag auf Gedenkzustand', url: 'https://www.facebook.com/help/requestmemorialization' },
      { label: 'Info zu Konten im Gedenkzustand', url: 'https://de-de.facebook.com/help/1017717331640041' },
    ],
    note: 'Zu Lebzeiten lässt sich unter Einstellungen ein „Nachlasskontakt" bestimmen, der das Gedenkkonto später begrenzt verwalten darf. Die Bearbeitung kann einige Wochen dauern.',
    verified: true,
    match: ['facebook'],
  },
  {
    service: 'Instagram',
    category: 'Social Media',
    contactPoint:
      'Das Profil kann in den Gedenkzustand versetzt (Meldung genügt) oder als bevollmächtigte Person entfernt werden.',
    steps: [
      'Gedenkzustand: das Konto über das Meldeformular als „verstorben" melden (mit Todesnachweis, z. B. Nachruf).',
      'Entfernung: als unmittelbare/r Angehörige/r mit Sterbeurkunde und Nachweis der Verwandtschaft beantragen.',
    ],
    links: [
      { label: 'Instagram: Konto einer verstorbenen Person melden', url: 'https://help.instagram.com/264154560391256' },
      { label: 'Info zu Konten im Gedenkzustand', url: 'https://help.instagram.com/231764660354188' },
    ],
    note: 'Im Gedenkzustand ist kein Login mehr möglich; die Inhalte bleiben sichtbar.',
    verified: true,
    match: ['instagram'],
  },
  {
    service: 'Google-Konto (Gmail, YouTube, Drive)',
    category: 'Kommunikation & Cloud',
    contactPoint:
      'Google löst Konten Verstorbener auf Antrag naher Angehöriger auf und kann in Ausnahmefällen Inhalte herausgeben — jedoch niemals Passwörter.',
    steps: [
      'Antrag über das offizielle Formular „Anfrage bezüglich des Kontos eines verstorbenen Nutzers" stellen.',
      'Identität und Verwandtschaft nachweisen (Ausweis, Sterbeurkunde; für Inhalte ggf. weitere Dokumente/gerichtliche Anordnung).',
      'Vorsorge: zu Lebzeiten den „Kontoinaktivität-Manager" einrichten, um Daten automatisch an Vertrauenspersonen weiterzugeben.',
    ],
    links: [
      { label: 'Google: Anfrage zum Konto einer verstorbenen Person', url: 'https://support.google.com/accounts/troubleshooter/6357590?hl=de' },
      { label: 'Kontoinaktivität-Manager (Vorsorge)', url: 'https://support.google.com/accounts/answer/3036546?hl=de' },
    ],
    verified: true,
    match: ['google', 'gmail', 'youtube', 'google drive'],
  },
  {
    service: 'Apple-ID / iCloud',
    category: 'Cloud',
    contactPoint:
      'Mit einem zu Lebzeiten festgelegten „Nachlasskontakt" (Digital Legacy) erhalten Hinterbliebene per Zugriffsschlüssel und Sterbeurkunde Zugang. Ohne Nachlasskontakt ist ein separater Antrag bei Apple nötig.',
    steps: [
      'Falls vorhanden: als Nachlasskontakt mit dem Zugriffsschlüssel und der Sterbeurkunde den Zugriff bei Apple beantragen.',
      'Ohne Nachlasskontakt: Zugriff auf den Apple-Account der verstorbenen Person bei Apple beantragen (Nachweise erforderlich).',
      'Vorsorge: unter Einstellungen › [Name] › Anmeldung & Sicherheit › Nachlasskontakt eine Vertrauensperson hinzufügen.',
    ],
    links: [
      { label: 'Apple: Zugriff auf den Account eines verstorbenen Familienmitglieds', url: 'https://support.apple.com/de-ch/102431' },
      { label: 'Apple: Nachlasskontakt hinzufügen', url: 'https://support.apple.com/de-ch/102631' },
    ],
    note: 'Nach Genehmigung ist der Datenzugriff bis zu drei Jahre möglich; gekaufte Medien und im Schlüsselbund gespeicherte Passwörter sind ausgeschlossen.',
    verified: true,
    match: ['apple', 'icloud'],
  },
  {
    service: 'Microsoft-Konto (Outlook, OneDrive)',
    category: 'Cloud',
    contactPoint:
      'Microsoft gibt Daten Verstorbener nur eingeschränkt und in der Regel nur auf richterliche Anordnung heraus. Inaktive Konten werden nach rund einem Jahr gesperrt und gelöscht.',
    steps: [
      'Laufende Abonnements und Zahlungen stoppen (z. B. Zahlungsmittel bzw. Bank informieren).',
      'Für einen Kontozugriff rechtlichen Rat einholen; Microsoft verlangt üblicherweise eine gerichtliche Anordnung nebst Nachweisen und Sterbeurkunde.',
      'Andernfalls das Konto durch Inaktivität auslaufen lassen (Löschung nach ca. einem Jahr).',
    ],
    links: [
      { label: 'Microsoft: Zugriff auf Konten Verstorbener (Outlook/OneDrive)', url: 'https://support.microsoft.com/en-us/accounts-billing/manage/accessing-outlook-com-onedrive-and-other-microsoft-services-when-someone-has-died' },
    ],
    note: 'Die offizielle Hilfeseite ist teilweise nur auf Englisch verfügbar.',
    verified: true,
    match: ['microsoft', 'outlook', 'hotmail', 'onedrive'],
  },
  {
    service: 'WhatsApp',
    category: 'Kommunikation',
    contactPoint:
      'WhatsApp bietet keinen direkten Konto-Zugriff für Dritte. Angehörige können die Löschung anstossen; ungenutzte Konten werden nach 120 Tagen automatisch entfernt.',
    steps: [
      'WhatsApp kontaktieren und mitteilen, dass die Person verstorben ist — unter Angabe der Telefonnummer im internationalen Format.',
      'Alternativ das Konto durch Inaktivität auslaufen lassen: Nach 120 Tagen ohne Nutzung wird es automatisch gelöscht.',
    ],
    links: [
      { label: 'WhatsApp: Löschung inaktiver Konten', url: 'https://faq.whatsapp.com/828406668498455' },
    ],
    note: 'Ein Zugriff auf Chat-Inhalte ist für Dritte nicht vorgesehen.',
    verified: true,
    match: ['whatsapp'],
  },
  {
    service: 'X (Twitter)',
    category: 'Social Media',
    contactPoint:
      'X kann Konten Verstorbener auf Antrag bevollmächtigter Personen oder verifizierter unmittelbarer Angehöriger deaktivieren. Ein Zugriff auf das Konto wird nicht gewährt.',
    steps: [
      'Antrag über das X-Formular für Konten Verstorbener stellen.',
      'Nach Rückmeldung von X die geforderten Nachweise liefern (Angaben zur verstorbenen Person, Ausweiskopie, Sterbeurkunde).',
    ],
    links: [
      { label: 'X: Konto einer verstorbenen Person melden', url: 'https://help.x.com/en/rules-and-policies/contact-x-about-a-deceased-family-members-account' },
    ],
    verified: true,
    match: ['x (twitter)', 'twitter', ' x ', 'x-'],
  },
  {
    service: 'LinkedIn',
    category: 'Social Media',
    contactPoint:
      'Nicht bevollmächtigte Personen können das Profil als „verstorben" melden (LinkedIn versetzt es in den Gedenkzustand); Bevollmächtigte können die Schliessung beantragen.',
    steps: [
      'Gedenkzustand: das Profil über das Formular als verstorben melden.',
      'Schliessung: als bevollmächtigte Person mit Nachweisen (z. B. gerichtliche Bestellung, Ausweisdokumente) die Löschung beantragen.',
    ],
    links: [
      { label: 'LinkedIn: Konto eines verstorbenen Mitglieds', url: 'https://www.linkedin.com/help/linkedin/answer/a1336663' },
    ],
    note: 'Nach der Schliessung dauert die vollständige Löschung der Daten bis zu 30 Tage.',
    verified: true,
    match: ['linkedin'],
  },
  {
    service: 'TikTok',
    category: 'Social Media',
    contactPoint:
      'TikTok bearbeitet Anliegen zu Konten Verstorbener über den Support (Meldung des Kontos). Ein öffentliches Self-Service-Formular ist nicht durchgängig verfügbar.',
    steps: [
      'Das Konto bzw. das Anliegen über den TikTok-Support melden („verstorbene Person").',
      'Nachweis der Verwandtschaft/Berechtigung und einen Todesnachweis (Sterbeurkunde) bereithalten.',
    ],
    links: [
      { label: 'TikTok: Sicherheit & Konten (Support)', url: 'https://support.tiktok.com/de/safety-hc/account-and-user-safety' },
    ],
    note: 'Die Handhabung erfolgt über den TikTok-Support; bitte prüfen Sie die dortigen aktuellen Angaben.',
    verified: false,
    match: ['tiktok'],
  },
  {
    service: 'PayPal',
    category: 'Finanzen',
    contactPoint:
      'Der/die Nachlassverwalter/in kann das Konto schliessen lassen; ein Restguthaben wird an den Nachlass ausgezahlt.',
    steps: [
      'Einen Todesnachweis (z. B. Sterbeurkunde) sowie einen Nachweis der Berechtigung (z. B. Erbschein/Testamentsvollstreckerzeugnis) bereitstellen.',
      'Kontaktdaten der anfragenden Person und Angaben zum verstorbenen Kontoinhaber beifügen.',
      'Die Unterlagen über die offizielle PayPal-Hilfe einreichen.',
    ],
    links: [
      { label: 'PayPal Schweiz: Konto einer verstorbenen Person schliessen', url: 'https://www.paypal.com/ch/cshelp/article/wie-schlie%C3%9Fe-ich-das-paypal-konto-einer-verstorbenen-person-help220' },
    ],
    verified: true,
    match: ['paypal'],
  },
  {
    service: 'Amazon',
    category: 'Sonstiges',
    contactPoint:
      'Amazon bearbeitet Anliegen zu Konten Verstorbener über einen speziellen Trauerfall-Support; Aktionen erfolgen nur durch berechtigte Nachlassvertreter.',
    steps: [
      'Den Trauerfall-Support kontaktieren (in Deutschland: bereavement-support@amazon.de).',
      'Nachweis der Berechtigung (beglaubigte Dokumente) und Ausweis der anfragenden Person bereitstellen.',
      'Die Kontoschliessung beantragen (endgültig; Zugriff auf Inhalte/Dienste entfällt danach).',
    ],
    links: [
      { label: 'Amazon: Unterstützung bei Trauerfällen', url: 'https://www.amazon.de/gp/help/customer/display.html?nodeId=GZZQG845T3NKYX9D' },
    ],
    verified: true,
    match: ['amazon'],
  },
  {
    service: 'Dropbox',
    category: 'Cloud',
    contactPoint:
      'Dropbox gibt Dateien Verstorbener nur bei entsprechender rechtlicher Grundlage (in der Regel gerichtliche Anordnung) heraus.',
    steps: [
      'Zunächst prüfen, ob lokal auf einem Gerät Zugriff auf die Dropbox-Ordner besteht.',
      'Andernfalls den Zugriff bei Dropbox beantragen und eine gerichtliche Anordnung vorlegen, die den Zugriff rechtfertigt.',
    ],
    links: [
      { label: 'Dropbox: Zugriff auf das Konto einer verstorbenen Person', url: 'https://help.dropbox.com/account-settings/access-account-of-someone-who-passed-away' },
    ],
    verified: true,
    match: ['dropbox'],
  },
  {
    service: 'Krypto-Wallets & -Börsen',
    category: 'Krypto',
    contactPoint:
      'Bei Börsen (z. B. Coinbase) beantragen Erben den Zugriff mit Nachlassdokumenten. Bei selbstverwalteten Wallets (z. B. Ledger) ist OHNE Seed-Phrase bzw. Private Key kein Zugriff möglich — die Vorsorge ist hier entscheidend.',
    steps: [
      'Börsenkonto (z. B. Coinbase): Kontakt aufnehmen und Nachlassdokumente (z. B. Erbschein) sowie den Ausweis der berechtigten Person vorlegen.',
      'Selbstverwaltete Wallets: Seed-Phrase/Recovery-Wörter und Zugangsdaten sichern — ohne sie sind die Guthaben unwiederbringlich verloren.',
      'Vorsorge: den Aufbewahrungsort der Seed-Phrase sicher dokumentieren (niemals digital im Klartext).',
    ],
    links: [
      { label: 'Coinbase: Zugriff auf das Konto einer verstorbenen Person', url: 'https://help.coinbase.com/en/coinbase/managing-my-account/other/how-do-i-gain-access-to-a-deceased-family-members-coinbase-account' },
    ],
    note: 'Kryptowährungen ohne gesicherten Schlüssel sind der häufigste Totalverlust im digitalen Nachlass.',
    verified: true,
    match: ['krypto', 'crypto', 'bitcoin', 'coinbase', 'ledger', 'binance', 'kraken', 'metamask', 'wallet'],
  },
  {
    service: 'Schweizer Bank- & Finanzkonten',
    category: 'Finanzen',
    contactPoint:
      'Informieren Sie die Bank umgehend über den Todesfall — sie sichert das Konto. Die Erbinnen und Erben bilden eine Erbengemeinschaft und verfügen gemeinsam.',
    steps: [
      'Die Bank umgehend informieren (das Konto wird gesichert); eine Kopie der Sterbeurkunde bereithalten.',
      'Eine Erbbescheinigung beibringen; ist noch keine vorhanden, genügt der Bank teils die Sterbeurkunde nebst Nachweis der Familienverhältnisse.',
      'Verfügungen gemeinsam als Erbengemeinschaft oder über eine bevollmächtigte Person vornehmen. TWINT ist an ein Bankkonto gekoppelt und wird über die Bank abgewickelt.',
    ],
    links: [
      { label: 'PostFinance: Todesfall melden', url: 'https://www.postfinance.ch/en/support/services/death/information-for-bereaved.html' },
      { label: 'ch.ch: Erbschein / Erbbescheinigung', url: 'https://www.ch.ch/de/familie-und-partnerschaft/erbschaft/erbschein/' },
    ],
    note: 'Das konkrete Vorgehen ist bei UBS, Raiffeisen, Kantonalbanken, Migros Bank, Yuh, Swissquote u. a. sehr ähnlich; prüfen Sie zusätzlich die Seite Ihrer Bank.',
    verified: true,
    match: ['postfinance', 'ubs', 'raiffeisen', 'kantonalbank', 'zkb', 'migros bank', 'yuh', 'swissquote', 'viseca', 'twint', 'neon', 'bank'],
  },
  {
    service: 'Telekom-Anbieter (Swisscom, Sunrise, Salt)',
    category: 'Kommunikation',
    contactPoint:
      'Melden Sie den Todesfall dem Anbieter; das Abo lässt sich kündigen oder übernehmen. Für den Zugriff auf zugehörige E-Mail-Konten (z. B. Bluewin) ist eine Erbbescheinigung nötig.',
    steps: [
      'Den Todesfall telefonisch oder schriftlich melden (Swisscom: 0800 055 055) und laufende Abos kündigen oder übernehmen.',
      'Für den Zugriff auf die Anbieter-E-Mail (z. B. Bluewin) eine Kopie der Erbbescheinigung bereithalten.',
      'Weitere gekoppelte Dienste (TV, Cloud, Rufnummern) prüfen und deren Weiterführung oder Kündigung regeln.',
    ],
    links: [
      { label: 'Swisscom: Todesfall melden (Abo kündigen/übernehmen)', url: 'https://www.swisscom.ch/en/residential/help/bill-and-contract/death.html' },
    ],
    verified: true,
    match: ['swisscom', 'bluewin', 'sunrise', 'salt'],
  },
  {
    service: 'Proton (Mail, Drive, Pass)',
    category: 'Cloud',
    contactPoint:
      'Proton nutzt eine Zero-Access-Verschlüsselung: Ohne vorab eingerichteten Notfallzugang kann Proton die Inhalte NICHT herausgeben. Die Vorsorge zu Lebzeiten ist entscheidend.',
    steps: [
      'Zu Lebzeiten „Emergency Access" (Notfallzugang) für eine Vertrauensperson einrichten — mit selbst gewählter Wartezeit.',
      'Als hinterlegter Notfallkontakt den Zugriff anfordern; nach Ablauf der Wartezeit wird er automatisch gewährt.',
    ],
    links: [
      { label: 'Proton: Emergency Access (Notfallzugang)', url: 'https://proton.me/support/emergency-access' },
    ],
    note: 'Ohne vorab eingerichteten Notfallzugang ist ein nachträglicher Zugriff praktisch ausgeschlossen.',
    verified: true,
    match: ['proton'],
  },
];

export const GENERAL_SECTIONS: GeneralSection[] = [
  {
    title: 'Rechtlicher Rahmen in der Schweiz',
    paragraphs: [
      'In der Schweiz gehen Rechte und Pflichten einer verstorbenen Person mit dem Tod grundsätzlich auf die Erbinnen und Erben über (Universalsukzession nach ZGB). Das umfasst auch digitale Vermögenswerte und viele Vertragsverhältnisse mit Online-Anbietern. Die konkrete Handhabung hängt jedoch von den Nutzungsbedingungen des jeweiligen Dienstes und vom anwendbaren — oft ausländischen — Recht ab.',
      'Höchstpersönliche Inhalte wie private Nachrichten unterliegen besonderen Schutzinteressen; Anbieter geben sie häufig nur eingeschränkt oder auf gerichtliche Anordnung heraus. Das revidierte Datenschutzgesetz (revDSG) schützt Personendaten — beim Zugriff Dritter berufen sich Anbieter regelmässig auf Persönlichkeits- und Datenschutzüberlegungen.',
      'Wer Zugriff auf Konten oder Guthaben benötigt, weist seine Erbenstellung in der Regel mit einer Erbbescheinigung nach. Klare Regelungen zu Lebzeiten — etwa in einem Testament oder Erbvertrag sowie mit einem Vorsorgeauftrag für den Fall der Urteilsunfähigkeit — erleichtern den Angehörigen den Umgang mit dem digitalen Nachlass erheblich.',
    ],
  },
  {
    title: 'Sofortige Schritte im Todesfall',
    paragraphs: [
      'Beschaffen Sie zuerst die amtlichen Dokumente: die Todesbescheinigung sowie — für den Zugriff auf Vermögenswerte — die Erbbescheinigung. Viele Anbieter und Banken verlangen diese Nachweise, bevor sie tätig werden.',
      'Verschaffen Sie sich einen Überblick über die digitalen Konten der verstorbenen Person (E-Mail, Social Media, Cloud, Finanzdienste, Abonnements). Ein bestehendes Verzeichnis — wie das Compendium von diginachlass.ch — erleichtert dies erheblich.',
      'Kontaktieren Sie die Anbieter der Reihe nach und stossen Sie Gedenkzustand, Löschung oder Datenzugriff an. Prüfen Sie laufende Abonnements und Zahlungen und kündigen Sie diese, um unnötige Kosten zu vermeiden. Beachten Sie, dass manche Konten nach einer Inaktivitätsfrist automatisch gelöscht werden.',
    ],
  },
  {
    title: 'Vorsorge zu Lebzeiten',
    paragraphs: [
      'Legen Sie ein aktuelles Verzeichnis Ihrer wichtigsten digitalen Konten an — ohne Passwörter im Klartext. Genau dafür ist das Compendium gedacht: Es dokumentiert, welche Konten existieren und wie wichtig sie sind, ohne sensible Zugangsdaten preiszugeben.',
      'Nutzen Sie einen Passwort-Manager mit Notfallzugang und richten Sie — wo verfügbar — die anbieterseitigen Vorsorge-Funktionen ein: den Nachlasskontakt bei Apple, den Kontoinaktivität-Manager bei Google und den Nachlasskontakt bei Facebook.',
      'Hinterlegen Sie klare Anweisungen und Vollmachten und benennen Sie eine oder mehrere Vertrauenspersonen. Bewahren Sie besonders kritische Informationen — etwa die Seed-Phrase von Krypto-Wallets — sicher und für die Vertrauensperson auffindbar auf. So stellen Sie sicher, dass Ihr digitaler Nachlass in Ihrem Sinne geregelt wird.',
    ],
  },
];

export const WHITEPAPER_DISCLAIMER =
  'Dieses White Paper dient der allgemeinen Orientierung und stellt keine Rechts- oder Steuerberatung dar. Verfahren, Zuständigkeiten und Links der genannten Anbieter können sich jederzeit ändern — bitte prüfen Sie im Ernstfall stets die offiziellen Seiten der Anbieter. Für rechtsverbindliche Auskünfte wenden Sie sich an eine Fachperson (z. B. Notariat, Anwaltschaft oder die zuständige Behörde).';

/** Findet den Guide-Eintrag zu einem erfassten Dienstnamen (Stichwort-Abgleich). */
export function guideEntryForService(serviceName: string): GuideEntry | undefined {
  const n = serviceName.toLowerCase();
  return DEATH_HANDLING_GUIDE.find((e) => e.match.some((m) => n.includes(m.trim())));
}

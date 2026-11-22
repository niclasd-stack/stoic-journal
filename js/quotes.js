// Eigene, freie deutsche Übertragungen (keine geschützten modernen Übersetzungen).
// Stellenangaben: Marcus Aurelius, Selbstbetrachtungen (Buch, Kapitel);
// Seneca, Briefe an Lucilius (Brief, Abschnitt) und Dialoge; Epiktet, Handbüchlein (Kapitel).
import { parseYmd } from './stats.js';

const M = 'Marcus Aurelius', S = 'Seneca', E = 'Epiktet';
const SB = 'Selbstbetrachtungen', BL = 'Briefe an Lucilius', HB = 'Handbüchlein';

export const QUOTES = [
  [M, `${SB} II, 1`, 'Sag dir schon am Morgen: Heute begegne ich Aufdringlichen, Undankbaren, Anmaßenden, Hinterlistigen, Neidischen. Keiner von ihnen kann mir schaden – denn keiner kann mich zu etwas Schlechtem zwingen.'],
  [E, `${HB} 1`, 'Einiges steht in unserer Macht, anderes nicht. In unserer Macht stehen unser Urteil, unser Antrieb, unser Begehren und Meiden – kurz: alles, was unser eigenes Werk ist.'],
  [S, `${BL} 1, 1`, 'Nimm dich dir selbst zurück. Sammle und bewahre die Zeit, die dir bisher genommen, entwendet oder entglitten ist.'],
  [M, `${SB} V, 20`, 'Was dem Handeln im Weg steht, fördert das Handeln. Was den Weg versperrt, wird zum Weg.'],
  [E, `${HB} 5`, 'Nicht die Dinge selbst beunruhigen die Menschen, sondern ihre Urteile über die Dinge.'],
  [S, `${BL} 13, 4`, 'Es gibt mehr, was uns ängstigt, als was uns bedrängt. Wir leiden öfter in der Vorstellung als in der Wirklichkeit.'],
  [M, `${SB} IV, 3`, 'Nirgendwohin zieht sich ein Mensch ruhiger und ungestörter zurück als in die eigene Seele.'],
  [S, 'Vom Zorn III, 36', 'Welches deiner Übel hast du heute geheilt? Welchem Fehler hast du widerstanden? Worin bist du besser geworden?'],
  [E, `${HB} 8`, 'Verlange nicht, dass die Dinge geschehen, wie du willst. Wünsche, dass sie geschehen, wie sie geschehen – dann wird dein Leben gut verlaufen.'],
  [M, `${SB} V, 1`, 'Wenn du am Morgen ungern aufstehst, halte dir vor: Ich erwache, um das Werk eines Menschen zu tun.'],
  [S, `${BL} 2, 6`, 'Nicht wer wenig hat, ist arm, sondern wer mehr begehrt.'],
  [M, `${SB} IV, 7`, 'Nimm das Urteil weg, und das „Mir ist Unrecht geschehen“ ist weg. Nimm das „Mir ist Unrecht geschehen“ weg, und das Unrecht selbst ist weg.'],
  [E, `${HB} 11`, 'Sag niemals von etwas: „Ich habe es verloren“, sondern: „Ich habe es zurückgegeben.“'],
  [S, 'Von der Kürze des Lebens 1, 3', 'Wir haben nicht zu wenig Zeit – wir verschwenden nur viel davon.'],
  [M, `${SB} IV, 17`, 'Lebe nicht, als hättest du zehntausend Jahre vor dir. Das Unvermeidliche schwebt über dir. Solange du lebst, solange du kannst: werde gut.'],
  [E, `${HB} 20`, 'Wenn dich jemand reizt, wisse: Es ist dein eigenes Urteil, das dich gereizt hat.'],
  [S, `${BL} 71, 3`, 'Wer nicht weiß, welchen Hafen er ansteuert, für den ist kein Wind der richtige.'],
  [M, `${SB} V, 16`, 'Wie deine häufigen Gedanken sind, so wird deine Gesinnung sein. Denn die Seele nimmt die Farbe ihrer Gedanken an.'],
  [E, `${HB} 43`, 'Jedes Ding hat zwei Henkel: einen, an dem man es tragen kann, und einen, an dem man es nicht tragen kann.'],
  [S, 'Von der Kürze des Lebens 9, 1', 'Das größte Hindernis des Lebens ist die Erwartung: Sie hängt am Morgen und verliert das Heute.'],
  [M, `${SB} VI, 6`, 'Die beste Art, sich zu wehren, ist, nicht so zu werden wie der andere.'],
  [S, `${BL} 7, 8`, 'Indem die Menschen lehren, lernen sie.'],
  [M, `${SB} IV, 49`, 'Sei wie der Fels, an dem sich unablässig die Wellen brechen. Er steht fest, und um ihn herum legt sich das Toben des Wassers.'],
  [E, `${HB} 46`, 'Nenne dich niemals einen Philosophen und rede unter Laien nicht viel über Grundsätze – handle nach ihnen.'],
  [S, `${BL} 107, 11`, 'Den Willigen führt das Schicksal, den Unwilligen schleift es mit.'],
  [M, `${SB} VII, 8`, 'Lass dich von der Zukunft nicht beunruhigen. Du wirst ihr, wenn es sein muss, mit derselben Vernunft begegnen, die du jetzt für die Gegenwart gebrauchst.'],
  [S, `${BL} 16, 3`, 'Die Philosophie ist keine Kunst für den Beifall der Menge. Sie liegt nicht in Worten, sondern in Taten.'],
  [M, `${SB} III, 10`, 'Jeder lebt nur diesen gegenwärtigen Augenblick. Alles andere ist entweder schon gelebt oder ungewiss.'],
  [E, `${HB} 51`, 'Wie lange willst du noch warten, bis du dich des Besten für würdig hältst?'],
  [S, `${BL} 28`, 'Du musst deine Seele ändern, nicht den Himmel, unter dem du lebst.'],
  [M, `${SB} VI, 21`, 'Wenn mir jemand überzeugend zeigt, dass ich falsch denke oder handle, ändere ich mich gern. Ich suche die Wahrheit, und durch sie ist noch nie jemand geschädigt worden.'],
  [S, `${BL} 1, 3`, 'Während man es aufschiebt, eilt das Leben vorüber.'],
  [M, `${SB} VII, 59`, 'Grabe in dir. Innen ist die Quelle des Guten, und sie kann immer weiter sprudeln, wenn du immer weiter gräbst.'],
  ['Zenon von Kition', 'nach Diogenes Laertius VII, 23', 'Wir haben zwei Ohren und nur einen Mund, damit wir mehr hören und weniger reden.'],
  [M, `${SB} VIII, 47`, 'Wenn dich etwas Äußeres bedrückt, so stört dich nicht die Sache selbst, sondern dein Urteil darüber. Und dieses Urteil kannst du sofort tilgen.'],
  [S, `${BL} 5, 7`, 'Du wirst aufhören zu fürchten, wenn du aufgehört hast zu hoffen.'],
  [M, `${SB} X, 16`, 'Rede nicht länger darüber, wie ein guter Mensch sein soll – sei einer.'],
  [S, 'Von der Vorsehung', 'Das Feuer prüft das Gold, das Unglück die Starken.'],
  [M, `${SB} VIII, 59`, 'Die Menschen sind füreinander da. Also belehre sie oder ertrage sie.'],
  [M, `${SB} II, 11`, 'Du könntest jetzt gleich aus dem Leben scheiden. Danach richte jedes Tun, Reden und Denken.'],
  [M, `${SB} VII, 69`, 'Vollkommenheit des Charakters heißt: jeden Tag zu leben, als wäre er der letzte – ohne Hast, ohne Trägheit, ohne Verstellung.'],
  [M, `${SB} IV, 24`, '„Tu wenig, wenn du heiter sein willst.“ Besser noch: Tu das Notwendige – und nur das.'],
  [M, `${SB} XII, 4`, 'Jeder liebt sich selbst mehr als alle anderen – und gibt doch auf die Meinung anderer über sich mehr als auf die eigene.'],
  [M, `${SB} VII, 47`, 'Betrachte den Lauf der Sterne, als liefest du mit ihnen. Solche Gedanken reinigen vom Staub des Alltags.'],
  [M, `${SB} VI, 30`, 'Sieh zu, dass du nicht verkaiserst. Bewahre dich schlicht, gut, rein, ernst, ungekünstelt, gerecht und freundlich.'],
].map(([author, source, text]) => ({ author, source, text }));

// Gleiches Datum → gleiches Zitat auf allen Geräten.
export function quoteForDate(ymd) {
  const d = parseYmd(ymd);
  const day = Math.floor(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 86400000);
  return QUOTES[((day % QUOTES.length) + QUOTES.length) % QUOTES.length];
}

export const OCTOBER_ROSE_MESSAGES = [
  "En octobre, faisons place à la sensibilisation.",
  "Un message de soutien peut illuminer une journée.",
  "Ensemble, faisons circuler une information fiable.",
  "Un ruban, mille façons de montrer notre solidarité.",
  "Prenons le temps d’écouter celles et ceux qui en ont besoin.",
  "La solidarité se vit aussi dans les petits gestes.",
  "Aujourd’hui encore, faisons vivre le soutien et l’espoir.",
  "Prendre des nouvelles, c’est déjà prendre soin.",
  "Derrière chaque ruban, il y a une personne et une histoire.",
  "La bienveillance commence par une écoute sans jugement.",
  "Faisons de la place aux paroles, aux silences et aux émotions.",
  "Soutenir, c’est aussi respecter le rythme de chacun.",
  "Une présence sincère compte plus que les mots parfaits.",
  "Partageons des ressources fiables, avec attention et respect.",
  "À mi-chemin d’octobre, notre solidarité reste entière.",
  "Personne ne devrait se sentir seul face à la maladie.",
  "Un appel, une visite, une attention : le soutien prend mille formes.",
  "Aujourd’hui, remercions celles et ceux qui accompagnent.",
  "Aux proches et aux aidants : votre présence compte aussi.",
  "Chaque histoire mérite d’être accueillie avec dignité.",
  "Laissons à chacun la liberté de parler quand il le souhaite.",
  "Informons-nous pour mieux comprendre et mieux accompagner.",
  "Un geste concret peut alléger une journée difficile.",
  "Faisons grandir une communauté attentive aux autres.",
  "Le courage a plusieurs visages, y compris celui de demander du soutien.",
  "Écoutons les besoins avant de proposer notre aide.",
  "Portons le rose avec respect pour tous les parcours.",
  "La solidarité ne demande pas de grands discours, mais de la présence.",
  "Gardons une place pour la douceur dans nos échanges.",
  "Octobre touche à sa fin ; notre attention aux autres continue.",
  "Le mois se termine, le soutien reste : ensemble, au-delà du ruban.",
] as const;

export function getOctoberRoseMessage(day: number): string {
  return OCTOBER_ROSE_MESSAGES[day - 1] ?? OCTOBER_ROSE_MESSAGES[0];
}

export function getLocalDayKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function formatOctoberRoseDate(dayKey: string): string {
  const [year, month, day] = dayKey.split("-").map(Number);
  return new Date(year, month - 1, day).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

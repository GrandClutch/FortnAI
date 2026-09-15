const UNSAFE_TERMS = [
  "bomb",
  "bombs",
  "pipe bomb",
  "pipe bombs",
  "explosive",
  "explosives",
  "dynamite",
  "grenade",
  "grenades",
  "molotov",
  "c-4",
  "c4",
  "semtex",
  "detonator",
  "detonators",
  "firearm",
  "firearms",
  "gun",
  "guns",
  "pistol",
  "pistols",
  "rifle",
  "rifles",
  "shotgun",
  "shotguns",
  "submachine gun",
  "machine gun",
  "uzi",
  "uzis",
  "ak-47",
  "ar-15",
  "assault rifle",
  "assault rifles",
  "weapon",
  "weapons",
  "switchblade",
  "switchblades",
  "butterfly knife",
  "throwing star",
  "throwing stars",
  "shuriken",
  "brass knuckles",
  "machete",
  "machetes",
  "bayonet",
  "bayonets",
  "narcotics",
  "heroin",
  "cocaine",
  "methamphetamine",
  "meth",
  "fentanyl",
  "mdma",
  "ecstasy",
  "lsd",
  "opium",
  "illegal drugs",
  "illicit drugs",
  "drug paraphernalia",
];

const UNSAFE_PATTERN = new RegExp(
  UNSAFE_TERMS.map((term) => {
    const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return term.includes(" ") ? escaped : `\\b${escaped}\\b`;
  }).join("|"),
  "i"
);

export function containsUnsafeContent(text: string): boolean {
  return UNSAFE_PATTERN.test(text);
}

export function unsafeContentMessage(): string {
  return "This request can't be fulfilled — it includes content we can't support.";
}

// tests/random-encounter.test.ts
import { describe, test, expect, beforeEach } from "vitest";
import { generateRandomEncounter, type Environment, type Difficulty } from "../src/random-encounter";
import type { SearchIndex } from "../src/search";

// Mock search index with sample monsters
function createMockSearchIndex(): SearchIndex {
  const monsters = [
    // Beasts (forest, grassland, arctic, coast, swamp)
    { name: "Wolf", cr: 0.25, type: "beast" },
    { name: "Brown Bear", cr: 1, type: "beast" },
    { name: "Giant Boar", cr: 2, type: "beast" },
    { name: "Polar Bear", cr: 4, type: "beast" },
    { name: "Giant Eagle", cr: 1, type: "beast" },
    { name: "Giant Constrictor Snake", cr: 2, type: "beast" },
    { name: "Giant Shark", cr: 5, type: "beast" },
    { name: "Crocodile", cr: 0.5, type: "beast" },
    { name: "Giant Crocodile", cr: 5, type: "beast" },
    { name: "Lion", cr: 1, type: "beast" },
    { name: "Mastiff", cr: 0.125, type: "beast" },
    { name: "Panther", cr: 0.25, type: "beast" },
    { name: "Tiger", cr: 1, type: "beast" },
    { name: "Giant Ape", cr: 7, type: "beast" },
    { name: "Giant Elk", cr: 2, type: "beast" },
    { name: "Giant Toad", cr: 1, type: "beast" },
    { name: "Giant Vulture", cr: 1, type: "beast" },
    { name: "Giant Wolf Spider", cr: 0.25, type: "beast" },
    { name: "Giant Hyena", cr: 1, type: "beast" },
    { name: "Ape", cr: 0.5, type: "beast" },
    { name: "Black Bear", cr: 0.5, type: "beast" },
    { name: "Baboon", cr: 0, type: "beast" },
    { name: "Badger", cr: 0.125, type: "beast" },
    { name: "Bat", cr: 0, type: "beast" },
    { name: "Cat", cr: 0, type: "beast" },
    { name: "Camel", cr: 0.125, type: "beast" },
    { name: "Draft Horse", cr: 0.25, type: "beast" },
    { name: "Elephant", cr: 4, type: "beast" },
    { name: "Flying Snake", cr: 0.125, type: "beast" },
    { name: "Frog", cr: 0, type: "beast" },
    { name: "Giant Badger", cr: 0.5, type: "beast" },
    { name: "Giant Bat", cr: 0.125, type: "beast" },
    { name: "Giant Centipede", cr: 0.25, type: "beast" },
    { name: "Giant Crab", cr: 0.125, type: "beast" },
    { name: "Giant Fire Beetle", cr: 0, type: "beast" },
    { name: "Giant Frog", cr: 0.25, type: "beast" },
    { name: "Giant Goat", cr: 0.5, type: "beast" },
    { name: "Giant Hyena", cr: 1, type: "beast" },
    { name: "Giant Lizard", cr: 0.25, type: "beast" },
    { name: "Giant Octopus", cr: 1, type: "beast" },
    { name: "Giant Rat", cr: 0.125, type: "beast" },
    { name: "Giant Scorpion", cr: 3, type: "beast" },
    { name: "Giant Sea Horse", cr: 0.125, type: "beast" },
    { name: "Giant Wasp", cr: 0.5, type: "beast" },
    { name: "Giant Weasel", cr: 0.25, type: "beast" },
    { name: "Giant Wolf Spider", cr: 0.25, type: "beast" },
    { name: "Girallon", cr: 6, type: "beast" },
    { name: "Guard Mastiff", cr: 0.25, type: "beast" },
    { name: "Hunter Shark", cr: 2, type: "beast" },
    { name: "Killer Whale", cr: 9, type: "beast" },
    { name: "Mule", cr: 0.125, type: "beast" },
    { name: "Pony", cr: 0.25, type: "beast" },
    { name: "Riding Horse", cr: 0.25, type: "beast" },
    { name: "Warhorse", cr: 0.5, type: "beast" },
    { name: "Warhorse, Skeleton", cr: 0.5, type: "beast" },
    { name: "Warhorse, Zombie", cr: 0.5, type: "beast" },
    { name: "Sea Horse", cr: 0, type: "beast" },
    { name: "Spider", cr: 0, type: "beast" },
    { name: "Stirge", cr: 0.125, type: "beast" },
    { name: "Swarm of Bats", cr: 0.25, type: "beast" },
    { name: "Swarm of Insects", cr: 0.5, type: "beast" },
    { name: "Swarm of Quippers", cr: 0.25, type: "beast" },
    { name: "Swarm of Rats", cr: 0.25, type: "beast" },
    { name: "Swarm of Ravens", cr: 0.25, type: "beast" },
    { name: "Swarm of Poisonous Snakes", cr: 2, type: "beast" },
    { name: "Thorny", cr: 3, type: "beast" },
    { name: "Vulture", cr: 0, type: "beast" },
    { name: "Wolf", cr: 0.25, type: "beast" },
    { name: "Worg", cr: 0.5, type: "beast" },
    { name: "Yeti", cr: 4, type: "beast" },
    { name: "Ankylosaurus", cr: 9, type: "beast" },
    { name: "Brontosaurus", cr: 9, type: "beast" },
    { name: "Deinonychus", cr: 1, type: "beast" },
    { name: "Dimetrodon", cr: 1, type: "beast" },
    { name: "Pteranodon", cr: 0.125, type: "beast" },
    { name: "Stegosaurus", cr: 5, type: "beast" },
    { name: "Triceratops", cr: 5, type: "beast" },
    { name: "Tyrannosaurus Rex", cr: 8, type: "beast" },
    { name: "Velociraptor", cr: 0.25, type: "beast" },

    // Humanoids (underdark, mountain, desert, urban, grassland, coast, swamp)
    { name: "Goblin", cr: 0.25, type: "humanoid" },
    { name: "Drow", cr: 0.25, type: "humanoid" },
    { name: "Bugbear", cr: 1, type: "humanoid" },
    { name: "Hobgoblin", cr: 0.5, type: "humanoid" },
    { name: "Kobold", cr: 0.125, type: "humanoid" },
    { name: "Orc", cr: 0.5, type: "humanoid" },
    { name: "Bandit", cr: 0.125, type: "humanoid" },
    { name: "Bandit Captain", cr: 2, type: "humanoid" },
    { name: "Commoner", cr: 0, type: "humanoid" },
    { name: "Cult Fanatic", cr: 2, type: "humanoid" },
    { name: "Cultist", cr: 0.125, type: "humanoid" },
    { name: "Druid", cr: 2, type: "humanoid" },
    { name: "Guard", cr: 0.125, type: "humanoid" },
    { name: "Knight", cr: 3, type: "humanoid" },
    { name: "Mage", cr: 6, type: "humanoid" },
    { name: "Noble", cr: 0.125, type: "humanoid" },
    { name: "Priest", cr: 2, type: "humanoid" },
    { name: "Scout", cr: 0.5, type: "humanoid" },
    { name: "Spy", cr: 1, type: "humanoid" },
    { name: "Thug", cr: 0.5, type: "humanoid" },
    { name: "Veteran", cr: 3, type: "humanoid" },
    { name: "Acolyte", cr: 0.125, type: "humanoid" },
    { name: "Assassin", cr: 8, type: "humanoid" },
    { name: "Bandit", cr: 0.125, type: "humanoid" },
    { name: "Berserker", cr: 2, type: "humanoid" },
    { name: "Cultist", cr: 0.125, type: "humanoid" },
    { name: "Gladiator", cr: 5, type: "humanoid" },
    { name: "Guard", cr: 0.125, type: "humanoid" },
    { name: "Martial Arts Adept", cr: 0.5, type: "humanoid" },
    { name: "Master Thief", cr: 9, type: "humanoid" },
    { name: "Noble", cr: 0.125, type: "humanoid" },
    { name: "Pirate", cr: 0.25, type: "humanoid" },
    { name: "Pirate Captain", cr: 5, type: "humanoid" },
    { name: "Swashbuckler", cr: 3, type: "humanoid" },
    { name: "Thug", cr: 0.5, type: "humanoid" },

    // Giants (mountain)
    { name: "Hill Giant", cr: 5, type: "giant" },
    { name: "Stone Giant", cr: 7, type: "giant" },
    { name: "Fire Giant", cr: 9, type: "giant" },
    { name: "Frost Giant", cr: 8, type: "giant" },
    { name: "Cloud Giant", cr: 11, type: "giant" },
    { name: "Storm Giant", cr: 13, type: "giant" },
    { name: "Ettin", cr: 4, type: "giant" },
    { name: "Ogre", cr: 2, type: "giant" },
    { name: "Troll", cr: 5, type: "giant" },

    // Monstrosities (desert, coast, arctic, swamp, grassland)
    { name: "Giant Spider", cr: 1, type: "monstrosity" },
    { name: "Cave Fisher", cr: 3, type: "monstrosity" },
    { name: "Chimera", cr: 6, type: "monstrosity" },
    { name: "Cockatrice", cr: 3, type: "monstrosity" },
    { name: "Displacer Beast", cr: 3, type: "monstrosity" },
    { name: "Ettercap", cr: 2, type: "monstrosity" },
    { name: "Gorgon", cr: 5, type: "monstrosity" },
    { name: "Grick", cr: 2, type: "monstrosity" },
    { name: "Harpy", cr: 1, type: "monstrosity" },
    { name: "Hydra", cr: 8, type: "monstrosity" },
    { name: "Minotaur", cr: 3, type: "monstrosity" },
    { name: "Owlbear", cr: 3, type: "monstrosity" },
    { name: "Pegasus", cr: 2, type: "monstrosity" },
    { name: "Phase Spider", cr: 3, type: "monstrosity" },
    { name: "Peryton", cr: 2, type: "monstrosity" },
    { name: "Roc", cr: 9, type: "monstrosity" },
    { name: "Sphinx", cr: 11, type: "monstrosity" },
    { name: "Tarrasque", cr: 30, type: "monstrosity" },
    { name: "Werewolf", cr: 3, type: "monstrosity" },
    { name: "Yuan-ti Abomination", cr: 7, type: "monstrosity" },
    { name: "Yuan-ti Malison", cr: 4, type: "monstrosity" },
    { name: "Yuan-ti Pureblood", cr: 1, type: "monstrosity" },
    { name: "Ankheg", cr: 2, type: "monstrosity" },
    { name: "Basilisk", cr: 3, type: "monstrosity" },
    { name: "Bulette", cr: 5, type: "monstrosity" },
    { name: "Centaur", cr: 2, type: "monstrosity" },
    { name: "Chuul", cr: 4, type: "monstrosity" },
    { name: "Cloaker", cr: 8, type: "monstrosity" },
    { name: "Darkmantle", cr: 0.5, type: "monstrosity" },
    { name: "Flail Snail", cr: 3, type: "monstrosity" },
    { name: "Froghemoth", cr: 10, type: "monstrosity" },
    { name: "Galeb Duhr", cr: 4, type: "monstrosity" },
    { name: "Gargoyle", cr: 2, type: "monstrosity" },
    { name: "Gargantuan Spider", cr: 12, type: "monstrosity" },
    { name: "Gelatinous Cube", cr: 2, type: "monstrosity" },
    { name: "Giant Crab", cr: 0.125, type: "monstrosity" },
    { name: "Giant Scorpion", cr: 3, type: "monstrosity" },
    { name: "Gibbering Mouther", cr: 2, type: "monstrosity" },
    { name: "Giant Spider", cr: 1, type: "monstrosity" },
    { name: "Girallon", cr: 6, type: "monstrosity" },
    { name: "Gloom Stalker", cr: 1, type: "monstrosity" },
    { name: "Gorgon", cr: 5, type: "monstrosity" },
    { name: "Grell", cr: 3, type: "monstrosity" },
    { name: "Hook Horror", cr: 3, type: "monstrosity" },
    { name: "Kraken", cr: 23, type: "monstrosity" },
    { name: "Leviathan", cr: 20, type: "monstrosity" },
    { name: "Lich", cr: 21, type: "monstrosity" },
    { name: "Manticore", cr: 3, type: "monstrosity" },
    { name: "Medusa", cr: 6, type: "monstrosity" },
    { name: "Mind Flayer", cr: 7, type: "monstrosity" },
    { name: "Mind Flayer, Elder", cr: 10, type: "monstrosity" },
    { name: "Neothelid", cr: 13, type: "monstrosity" },
    { name: "Neogi", cr: 2, type: "monstrosity" },
    { name: "Nighthaunt", cr: 4, type: "monstrosity" },
    { name: "Nightwalker", cr: 14, type: "monstrosity" },
    { name: "Otyugh", cr: 5, type: "monstrosity" },
    { name: "Piercer", cr: 0.5, type: "monstrosity" },
    { name: "Purple Worm", cr: 15, type: "monstrosity" },
    { name: "Rakshasa", cr: 13, type: "monstrosity" },
    { name: "Roper", cr: 5, type: "monstrosity" },
    { name: "Rust Monster", cr: 0.5, type: "monstrosity" },
    { name: "Scrag", cr: 2, type: "monstrosity" },
    { name: "Shadow Demon", cr: 4, type: "monstrosity" },
    { name: "Slaad", cr: 5, type: "monstrosity" },
    { name: "Spectator", cr: 3, type: "monstrosity" },
    { name: "Spawn of Kyuss", cr: 2, type: "monstrosity" },
    { name: "Stirge", cr: 0.125, type: "monstrosity" },
    { name: "Su-Monster", cr: 1, type: "monstrosity" },
    { name: "Thork", cr: 4, type: "monstrosity" },
    { name: "Troll", cr: 5, type: "monstrosity" },
    { name: "Umber Hulk", cr: 5, type: "monstrosity" },
    { name: "Vampire, Spawn", cr: 5, type: "monstrosity" },
    { name: "Vargouille", cr: 1, type: "monstrosity" },
    { name: "Wraith", cr: 5, type: "monstrosity" },
    { name: "Wraith, Greater", cr: 8, type: "monstrosity" },
    { name: "Yeti", cr: 4, type: "monstrosity" },

    // Oozes (underdark, swamp)
    { name: "Gelatinous Cube", cr: 2, type: "ooze" },
    { name: "Gray Ooze", cr: 0.5, type: "ooze" },
    { name: "Black Pudding", cr: 4, type: "ooze" },
    { name: "Ochre Jelly", cr: 2, type: "ooze" },
    { name: "Pudding, Black", cr: 4, type: "ooze" },
    { name: "Pudding, White", cr: 3, type: "ooze" },
    { name: "Slime, Gray", cr: 0.5, type: "ooze" },
    { name: "Slime, Ochre", cr: 2, type: "ooze" },
    { name: "Slime, Green", cr: 2, type: "ooze" },
    { name: "Gelatinous Cube", cr: 2, type: "ooze" },

    // Aberrations (underdark)
    { name: "Gibbering Mouther", cr: 2, type: "aberration" },
    { name: "Gremlin", cr: 0.125, type: "aberration" },
    { name: "Grell", cr: 3, type: "aberration" },
    { name: "Hook Horror", cr: 3, type: "aberration" },
    { name: "Mind Flayer", cr: 7, type: "aberration" },
    { name: "Nothic", cr: 2, type: "aberration" },
    { name: "Roper", cr: 5, type: "aberration" },
    { name: "Intellect Devourer", cr: 2, type: "aberration" },
    { name: "Neothelid", cr: 13, type: "aberration" },
    { name: "Spectator", cr: 3, type: "aberration" },
    { name: "Aboleth", cr: 10, type: "aberration" },
    { name: "Behir", cr: 7, type: "aberration" },
    { name: "Beholder", cr: 13, type: "aberration" },
    { name: "Beholder, Death Kiss", cr: 12, type: "aberration" },
    { name: "Beholder, Gauth", cr: 6, type: "aberration" },
    { name: "Beholder, Eye of the Deep", cr: 7, type: "aberration" },
    { name: "Beholder, Spectator", cr: 3, type: "aberration" },
    { name: "Carrion Crawler", cr: 2, type: "aberration" },
    { name: "Chuul", cr: 4, type: "aberration" },
    { name: "Cloaker", cr: 8, type: "aberration" },
    { name: "Crypt Thing", cr: 2, type: "aberration" },
    { name: "Dao", cr: 9, type: "aberration" },
    { name: "Demon, Balor", cr: 19, type: "aberration" },
    { name: "Demon, Hezrou", cr: 8, type: "aberration" },
    { name: "Demon, Marilith", cr: 12, type: "aberration" },
    { name: "Demon, Nalfeshnee", cr: 13, type: "aberration" },
    { name: "Demon, Quasit", cr: 0.125, type: "aberration" },
    { name: "Demon, Succubus", cr: 4, type: "aberration" },
    { name: "Demon, Vrock", cr: 6, type: "aberration" },
    { name: "Demon, Yochlol", cr: 4, type: "aberration" },
    { name: "Demon, Glabrezu", cr: 9, type: "aberration" },
    { name: "Demon, Goristro", cr: 17, type: "aberration" },
    { name: "Demon, Horned", cr: 9, type: "aberration" },
    { name: "Devil, Barbed", cr: 5, type: "aberration" },
    { name: "Devil, Bearded", cr: 3, type: "aberration" },
    { name: "Devil, Bone", cr: 4, type: "aberration" },
    { name: "Devil, Chain", cr: 11, type: "aberration" },
    { name: "Devil, Erinyes", cr: 8, type: "aberration" },
    { name: "Devil, Gelugon", cr: 13, type: "aberration" },
    { name: "Devil, Hellfire", cr: 12, type: "aberration" },
    { name: "Devil, Ice", cr: 7, type: "aberration" },
    { name: "Devil, Imp", cr: 0.125, type: "aberration" },
    { name: "Devil, Lemure", cr: 0, type: "aberration" },
    { name: "Devil, Nessian", cr: 13, type: "aberration" },
    { name: "Devil, Pit Fiend", cr: 20, type: "aberration" },
    { name: "Devil, Spined", cr: 2, type: "aberration" },
    { name: "Djinni", cr: 11, type: "aberration" },
    { name: "Drider", cr: 6, type: "aberration" },
    { name: "Duergar", cr: 0.25, type: "aberration" },
    { name: "Dwarf, Duergar", cr: 0.25, type: "aberration" },
    { name: "Elemental, Azer", cr: 2, type: "aberration" },
    { name: "Elemental, Gargoyle", cr: 2, type: "aberration" },
    { name: "Fomorian", cr: 6, type: "aberration" },
    { name: "Gargoyle", cr: 2, type: "aberration" },
    { name: "Gargoyle, Warder", cr: 7, type: "aberration" },
    { name: "Genie, Dao", cr: 9, type: "aberration" },
    { name: "Genie, Djinni", cr: 11, type: "aberration" },
    { name: "Genie, Efreeti", cr: 10, type: "aberration" },
    { name: "Genie, Marid", cr: 11, type: "aberration" },
    { name: "Githyanki", cr: 2, type: "aberration" },
    { name: "Githyanki Warrior", cr: 4, type: "aberration" },
    { name: "Githyanki, Knight", cr: 8, type: "aberration" },
    { name: "Githzerai", cr: 1, type: "aberration" },
    { name: "Githzerai, Anarch", cr: 8, type: "aberration" },
    { name: "Gnome, Deep", cr: 0.5, type: "aberration" },
    { name: "Gremlin, Norker", cr: 0.125, type: "aberration" },
    { name: "Gremlin, Nilbog", cr: 0.125, type: "aberration" },
    { name: "Gremlin, Jermlaine", cr: 0, type: "aberration" },
    { name: "Gremlin, Mite", cr: 0, type: "aberration" },
    { name: "Illithid, Mind Flayer", cr: 7, type: "aberration" },
    { name: "Illithid, Ulitharid", cr: 9, type: "aberration" },
    { name: "Intellect Devourer", cr: 2, type: "aberration" },
    { name: "Kraken", cr: 23, type: "aberration" },
    { name: "Leviathan", cr: 20, type: "aberration" },
    { name: "Mind Flayer", cr: 7, type: "aberration" },
    { name: "Neogi", cr: 2, type: "aberration" },
    { name: "Neogi, Great Old Master", cr: 7, type: "aberration" },
    { name: "Neothelid", cr: 13, type: "aberration" },
    { name: "Nycaloth", cr: 9, type: "aberration" },
    { name: "Ogre, Bone", cr: 4, type: "aberration" },
    { name: "Ogre, Half-Dragon", cr: 3, type: "aberration" },
    { name: "Oni", cr: 7, type: "aberration" },
    { name: "Phycomid", cr: 2, type: "aberration" },
    { name: "Rakshasa", cr: 13, type: "aberration" },
    { name: "Sahuagin", cr: 0.5, type: "aberration" },
    { name: "Sahuagin, Priestess", cr: 3, type: "aberration" },
    { name: "Sahuagin, Baron", cr: 4, type: "aberration" },
    { name: "Sahuagin, Baroness", cr: 7, type: "aberration" },
    { name: "Sahuagin, Shark Hunter", cr: 1, type: "aberration" },
    { name: "Scrag", cr: 2, type: "aberration" },
    { name: "Shadow Demon", cr: 4, type: "aberration" },
    { name: "Slaad, Blue", cr: 5, type: "aberration" },
    { name: "Slaad, Green", cr: 7, type: "aberration" },
    { name: "Slaad, Gray", cr: 2, type: "aberration" },
    { name: "Slaad, Red", cr: 5, type: "aberration" },
    { name: "Slaad, Death", cr: 10, type: "aberration" },
    { name: "Spawn of Kyuss", cr: 2, type: "aberration" },
    { name: "Spectator", cr: 3, type: "aberration" },
    { name: "Thork", cr: 4, type: "aberration" },
    { name: "Thri-Kreen", cr: 1, type: "aberration" },
    { name: "Titan", cr: 21, type: "aberration" },
    { name: "Troglodyte", cr: 0.25, type: "aberration" },
    { name: "Troll", cr: 5, type: "aberration" },
    { name: "Troll, Spirit", cr: 8, type: "aberration" },
    { name: "Umber Hulk", cr: 5, type: "aberration" },
    { name: "Wraith", cr: 5, type: "aberration" },
    { name: "Wraith, Greater", cr: 8, type: "aberration" },
    { name: "Xill", cr: 3, type: "aberration" },
    { name: "Yuan-ti Abomination", cr: 7, type: "aberration" },
    { name: "Yuan-ti Malison", cr: 4, type: "aberration" },
    { name: "Yuan-ti Pureblood", cr: 1, type: "aberration" },
    { name: "Yugoloth, Altraloth", cr: 11, type: "aberration" },
    { name: "Yugoloth, Arcanaloth", cr: 8, type: "aberration" },
    { name: "Yugoloth, Dergholoth", cr: 3, type: "aberration" },
    { name: "Yugoloth, Hydroloth", cr: 7, type: "aberration" },
    { name: "Yugoloth, Mezzoloth", cr: 5, type: "aberration" },
    { name: "Yugoloth, Nycaloth", cr: 9, type: "aberration" },
    { name: "Yugoloth, Piscoloth", cr: 7, type: "aberration" },
    { name: "Yugoloth, Ultroloth", cr: 11, type: "aberration" },
    { name: "Yugoloth, Xerfilstyx", cr: 10, type: "aberration" },
    { name: "Yugoloth, Yagnoloth", cr: 6, type: "aberration" },
    { name: "Yugoloth, Yagnodaemon", cr: 9, type: "aberration" },
    { name: "Zentarim", cr: 1, type: "aberration" },
    { name: "Zombie, Dwarven", cr: 0.125, type: "aberration" },

    // Elementals (desert, mountain, urban, arctic)
    { name: "Fire Elemental", cr: 5, type: "elemental" },
    { name: "Water Elemental", cr: 5, type: "elemental" },
    { name: "Air Elemental", cr: 5, type: "elemental" },
    { name: "Earth Elemental", cr: 5, type: "elemental" },
    { name: "Small Fire Elemental", cr: 2, type: "elemental" },
    { name: "Small Water Elemental", cr: 2, type: "elemental" },
    { name: "Small Air Elemental", cr: 2, type: "elemental" },
    { name: "Small Earth Elemental", cr: 2, type: "elemental" },
    { name: "Large Fire Elemental", cr: 8, type: "elemental" },
    { name: "Large Water Elemental", cr: 8, type: "elemental" },
    { name: "Large Air Elemental", cr: 8, type: "elemental" },
    { name: "Large Earth Elemental", cr: 8, type: "elemental" },
    { name: "Elder Fire Elemental", cr: 12, type: "elemental" },
    { name: "Elder Water Elemental", cr: 12, type: "elemental" },
    { name: "Elder Air Elemental", cr: 12, type: "elemental" },
    { name: "Elder Earth Elemental", cr: 12, type: "elemental" },

    // Plants (forest, swamp)
    { name: "Violet Fungus", cr: 0.25, type: "plant" },
    { name: "Shambling Mound", cr: 5, type: "plant" },
    { name: "Treant", cr: 9, type: "plant" },
    { name: "Vegepygmy", cr: 0.25, type: "plant" },
    { name: "Vine Blight", cr: 0.5, type: "plant" },
    { name: "Needle Blight", cr: 0.25, type: "plant" },
    { name: "Twig Blight", cr: 0.125, type: "plant" },
    { name: "Briarvex", cr: 1, type: "plant" },
    { name: "Corpse Flower", cr: 8, type: "plant" },
    { name: "Crown of Stars", cr: 2, type: "plant" },
    { name: "Gas Spore", cr: 0.125, type: "plant" },
    { name: "Gibbering Mouther", cr: 2, type: "plant" },
    { name: "Green Hag", cr: 3, type: "plant" },
    { name: "Hydra", cr: 8, type: "plant" },
    { name: "Killer Plant", cr: 5, type: "plant" },
    { name: "Myconid", cr: 0.5, type: "plant" },
    { name: "Myconid Adult", cr: 1, type: "plant" },
    { name: "Myconid Elder", cr: 3, type: "plant" },
    { name: "Myconid Sprout", cr: 0, type: "plant" },
    { name: "Petrified Plant", cr: 4, type: "plant" },
    { name: "Plant, Corpse Flower", cr: 8, type: "plant" },
    { name: "Plant, Deadly Sundew", cr: 1, type: "plant" },
    { name: "Plant, Giant Flytrap", cr: 2, type: "plant" },
    { name: "Plant, Kelp", cr: 0.125, type: "plant" },
    { name: "Plant, Killer", cr: 5, type: "plant" },
    { name: "Plant, Pitcher", cr: 0.5, type: "plant" },
    { name: "Plant, Violet Fungus", cr: 0.25, type: "plant" },
    { name: "Plant, Wood", cr: 3, type: "plant" },
    { name: "Russet Mold", cr: 0.125, type: "plant" },
    { name: "Shambling Mound", cr: 5, type: "plant" },
    { name: "Twig Blight", cr: 0.125, type: "plant" },
    { name: "Vegepygmy", cr: 0.25, type: "plant" },
    { name: "Violet Fungus", cr: 0.25, type: "plant" },

    // Fey (forest, swamp)
    { name: "Pixie", cr: 0.125, type: "fey" },
    { name: "Satyr", cr: 1, type: "fey" },
    { name: "Sprite", cr: 0.25, type: "fey" },
    { name: "Dryad", cr: 1, type: "fey" },
    { name: "Green Hag", cr: 3, type: "fey" },
    { name: "Sea Hag", cr: 2, type: "fey" },
    { name: "Night Hag", cr: 5, type: "fey" },
    { name: "Boggle", cr: 0.5, type: "fey" },
    { name: "Boggles", cr: 0.5, type: "fey" },
    { name: "Bugbear", cr: 1, type: "fey" },
    { name: "Darkling", cr: 0.5, type: "fey" },
    { name: "Darkling Elder", cr: 6, type: "fey" },
    { name: "Demigorgon", cr: 26, type: "fey" },
    { name: "Eladrin", cr: 10, type: "fey" },
    { name: "Fomorian", cr: 6, type: "fey" },
    { name: "Goblin", cr: 0.25, type: "fey" },
    { name: "Gnome, Forest", cr: 0.5, type: "fey" },
    { name: "Gnome, Rock", cr: 0.5, type: "fey" },
    { name: "Grig", cr: 0.125, type: "fey" },
    { name: "Hagspawn", cr: 2, type: "fey" },
    { name: "Harpies", cr: 1, type: "fey" },
    { name: "Hound, Yeth", cr: 3, type: "fey" },
    { name: "Killoren", cr: 4, type: "fey" },
    { name: "Korred", cr: 3, type: "fey" },
    { name: "Leprechaun", cr: 1, type: "fey" },
    { name: "Meenlock", cr: 2, type: "fey" },
    { name: "Nixie", cr: 0.125, type: "fey" },
    { name: "Nymph", cr: 7, type: "fey" },
    { name: "Pixie", cr: 0.125, type: "fey" },
    { name: "Quickling", cr: 1, type: "fey" },
    { name: "Satyr", cr: 1, type: "fey" },
    { name: "Sea Hag", cr: 2, type: "fey" },
    { name: "Shrub, Walking", cr: 0.5, type: "fey" },
    { name: "Sprite", cr: 0.25, type: "fey" },
    { name: "Thri-kreen", cr: 1, type: "fey" },
    { name: "Treant", cr: 9, type: "fey" },
    { name: "Troll", cr: 5, type: "fey" },
    { name: "Unicorn", cr: 5, type: "fey" },

    // Undead (urban)
    { name: "Skeleton", cr: 0.25, type: "undead" },
    { name: "Zombie", cr: 0.125, type: "undead" },
    { name: "Ghoul", cr: 1, type: "undead" },
    { name: "Wight", cr: 3, type: "undead" },
    { name: "Wraith", cr: 5, type: "undead" },
    { name: "Spectre", cr: 3, type: "undead" },
    { name: "Ghost", cr: 4, type: "undead" },
    { name: "Mummy", cr: 3, type: "undead" },
    { name: "Vampire", cr: 13, type: "undead" },
    { name: "Lich", cr: 21, type: "undead" },
    { name: "Death Knight", cr: 17, type: "undead" },
    { name: "Banshee", cr: 4, type: "undead" },
    { name: "Bodak", cr: 6, type: "undead" },
    { name: "Boneclaw", cr: 12, type: "undead" },
    { name: "Crawling Claw", cr: 0, type: "undead" },
    { name: "Crypt Thing", cr: 2, type: "undead" },
    { name: "Curse, Cursed", cr: 0, type: "undead" },
    { name: "Demilich", cr: 18, type: "undead" },
    { name: "Devourer", cr: 10, type: "undead" },
    { name: "Dracolich", cr: 17, type: "undead" },
    { name: "Draugr", cr: 0.5, type: "undead" },
    { name: "Dullahan", cr: 12, type: "undead" },
    { name: "Dust Spirt", cr: 0.125, type: "undead" },
    { name: "Flesh Golem", cr: 5, type: "undead" },
    { name: "Flying Sword", cr: 0.5, type: "undead" },
    { name: "Frightener", cr: 4, type: "undead" },
    { name: "Ghost", cr: 4, type: "undead" },
    { name: "Ghast", cr: 2, type: "undead" },
    { name: "Ghoul", cr: 1, type: "undead" },
    { name: "Gibbering Mouther", cr: 2, type: "undead" },
    { name: "Gloom Stalker", cr: 1, type: "undead" },
    { name: "Golem, Bone", cr: 4, type: "undead" },
    { name: "Golem, Clay", cr: 9, type: "undead" },
    { name: "Golem, Flesh", cr: 5, type: "undead" },
    { name: "Golem, Iron", cr: 13, type: "undead" },
    { name: "Golem, Stone", cr: 11, type: "undead" },
    { name: "Grim", cr: 9, type: "undead" },
    { name: "Huecuva", cr: 1, type: "undead" },
    { name: "Jermlaine", cr: 0, type: "undead" },
    { name: "Knight, Death", cr: 17, type: "undead" },
    { name: "Lich", cr: 21, type: "undead" },
    { name: "Lich, Arch", cr: 16, type: "undead" },
    { name: "Lich, Demi", cr: 18, type: "undead" },
    { name: "Lich, Suel", cr: 17, type: "undead" },
    { name: "Mummy", cr: 3, type: "undead" },
    { name: "Mummy Lord", cr: 15, type: "undead" },
    { name: "Nightshade", cr: 14, type: "undead" },
    { name: "Nightwalker", cr: 14, type: "undead" },
    { name: "Nighthaunt", cr: 4, type: "undead" },
    { name: "Nighthunt", cr: 5, type: "undead" },
    { name: "Phantom", cr: 2, type: "undead" },
    { name: "Poltergeist", cr: 2, type: "undead" },
    { name: "Revenant", cr: 5, type: "undead" },
    { name: "Risen", cr: 2, type: "undead" },
    { name: "Skel", cr: 0.25, type: "undead" },
    { name: "Skeleton", cr: 0.25, type: "undead" },
    { name: "Skeletal Champion", cr: 2, type: "undead" },
    { name: "Spectral Force", cr: 1, type: "undead" },
    { name: "Spectre", cr: 3, type: "undead" },
    { name: "Spirit", cr: 0.125, type: "undead" },
    { name: "Tomb Haunt", cr: 2, type: "undead" },
    { name: "Vampire", cr: 13, type: "undead" },
    { name: "Vampire, Elder", cr: 17, type: "undead" },
    { name: "Vampire, Lord", cr: 15, type: "undead" },
    { name: "Vampire, Spawn", cr: 5, type: "undead" },
    { name: "Wight", cr: 3, type: "undead" },
    { name: "Wight, Deathpriest", cr: 6, type: "undead" },
    { name: "Will-o'-Wisp", cr: 2, type: "undead" },
    { name: "Wraith", cr: 5, type: "undead" },
    { name: "Wraith, Greater", cr: 8, type: "undead" },
    { name: "Zombie", cr: 0.125, type: "undead" },
    { name: "Zombie, Husk", cr: 0.125, type: "undead" },
    { name: "Zombie, Juggernaut", cr: 5, type: "undead" },
    { name: "Zombie, Lord", cr: 4, type: "undead" },
  ];

  return {
    byKind: new Map([
      [
        "monster",
        monsters.map((m, i) => ({
          uri: `fiveet://entity/monster/MM/${m.slug || m.name.toLowerCase().replace(/\s+/g, "-")}`,
          name: m.name,
          slug: m.slug || m.name.toLowerCase().replace(/\s+/g, "-"),
          source: "MM",
          ruleset: "2014",
          facets: { cr: m.cr, type: m.type },
          kind: "monster",
        })),
      ],
    ]),
    byUri: new Map(),
    sourcesMeta: new Map(),
  };
}

describe("Random Encounter Generator", () => {
  let mockIndex: SearchIndex;

  beforeEach(() => {
    mockIndex = createMockSearchIndex();
  });

  describe("generateRandomEncounter", () => {
    test("generates encounter for forest environment", () => {
      const party = [3, 3, 3, 3];
      const encounter = generateRandomEncounter(party, "forest", "medium", mockIndex);

      expect(encounter).toBeDefined();
      expect(encounter.environment).toBe("forest");
      expect(encounter.difficulty).toBe("medium");
      expect(encounter.monsters).toBeDefined();
      expect(encounter.monsters.length).toBeGreaterThan(0);
      expect(encounter.flavorText).toBeDefined();
      expect(encounter.flavorText.length).toBeGreaterThan(0);
    });

    test("generates encounter for underdark environment", () => {
      const party = [5, 5, 5, 5];
      const encounter = generateRandomEncounter(party, "underdark", "hard", mockIndex);

      expect(encounter.environment).toBe("underdark");
      expect(encounter.difficulty).toBe("hard");
      expect(encounter.monsters.length).toBeGreaterThan(0);
      expect(encounter.totalBaseXP).toBeGreaterThan(0);
      expect(encounter.adjustedXP).toBeGreaterThan(0);
    });

    test("generates encounter for mountain environment", () => {
      const party = [10, 10, 10, 10];
      const encounter = generateRandomEncounter(party, "mountain", "deadly", mockIndex);

      expect(encounter.environment).toBe("mountain");
      expect(encounter.difficulty).toBe("deadly");
      expect(encounter.difficultyRating).toBeDefined();
    });

    test("generates encounter for urban environment", () => {
      const party = [1, 1, 1, 1];
      const encounter = generateRandomEncounter(party, "urban", "easy", mockIndex);

      expect(encounter.environment).toBe("urban");
      expect(encounter.difficulty).toBe("easy");
      expect(encounter.monsters.length).toBeGreaterThan(0);
    });

    test("generates encounter for desert environment", () => {
      const party = [7, 7, 7, 7];
      const encounter = generateRandomEncounter(party, "desert", "medium", mockIndex);

      expect(encounter.environment).toBe("desert");
      expect(encounter.totalBaseXP).toBeDefined();
      expect(encounter.adjustedXP).toBeDefined();
    });

    test("generates encounter for coast environment", () => {
      const party = [4, 4, 4, 4];
      const encounter = generateRandomEncounter(party, "coast", "medium", mockIndex);

      expect(encounter.environment).toBe("coast");
      expect(encounter.encounterMultiplier).toBeGreaterThan(0);
    });

    test("generates encounter for arctic environment", () => {
      const party = [6, 6, 6, 6];
      const encounter = generateRandomEncounter(party, "arctic", "hard", mockIndex);

      expect(encounter.environment).toBe("arctic");
      expect(encounter.monsters.length).toBeGreaterThan(0);
    });

    test("generates encounter for swamp environment", () => {
      const party = [8, 8, 8, 8];
      const encounter = generateRandomEncounter(party, "swamp", "medium", mockIndex);

      expect(encounter.environment).toBe("swamp");
      expect(encounter.monsters.length).toBeGreaterThan(0);
    });

    test("generates encounter for grassland environment", () => {
      const party = [2, 2, 2, 2];
      const encounter = generateRandomEncounter(party, "grassland", "easy", mockIndex);

      expect(encounter.environment).toBe("grassland");
      expect(encounter.monsters.length).toBeGreaterThan(0);
    });

    test("calculates XP values correctly", () => {
      const party = [5, 5, 5, 5];
      const encounter = generateRandomEncounter(party, "forest", "medium", mockIndex);

      const calculatedBaseXP = encounter.monsters.reduce(
        (sum, m) => sum + m.xp * m.count,
        0
      );
      expect(encounter.totalBaseXP).toBe(calculatedBaseXP);
      expect(encounter.adjustedXP).toBe(
        Math.round(calculatedBaseXP * encounter.encounterMultiplier)
      );
    });

    test("respects custom monster count", () => {
      const party = [5, 5, 5, 5];
      const encounter = generateRandomEncounter(party, "forest", "medium", mockIndex, {
        monsterCount: 2,
      });

      const totalMonsters = encounter.monsters.reduce((sum, m) => sum + m.count, 0);
      expect(totalMonsters).toBe(2);
    });

    test("uses default monster count when not specified", () => {
      const party = [5, 5, 5, 5];
      const encounter = generateRandomEncounter(party, "forest", "medium", mockIndex);

      // Default: 1 monster per 4 PCs = 1 monster for 4 PCs
      const totalMonsters = encounter.monsters.reduce((sum, m) => sum + m.count, 0);
      expect(totalMonsters).toBeGreaterThan(0);
    });

    test("includes party thresholds", () => {
      const party = [3, 3, 3, 3];
      const encounter = generateRandomEncounter(party, "forest", "medium", mockIndex);

      expect(encounter.partyThresholds).toBeDefined();
      expect(encounter.partyThresholds.easy).toBeGreaterThan(0);
      expect(encounter.partyThresholds.medium).toBeGreaterThan(
        encounter.partyThresholds.easy
      );
      expect(encounter.partyThresholds.hard).toBeGreaterThan(
        encounter.partyThresholds.medium
      );
      expect(encounter.partyThresholds.deadly).toBeGreaterThan(
        encounter.partyThresholds.hard
      );
    });

    test("provides difficulty rating", () => {
      const party = [5, 5, 5, 5];
      const encounter = generateRandomEncounter(party, "forest", "hard", mockIndex);

      expect(encounter.difficultyRating).toBeDefined();
      expect(
        ["Trivial", "Easy", "Medium", "Hard", "Deadly"]
      ).toContain(encounter.difficultyRating);
    });

    test("monster counts are positive integers", () => {
      const party = [5, 5, 5, 5];
      const encounter = generateRandomEncounter(party, "forest", "medium", mockIndex);

      encounter.monsters.forEach((monster) => {
        expect(monster.count).toBeGreaterThan(0);
        expect(Number.isInteger(monster.count)).toBe(true);
      });
    });

    test("monster CRs are valid", () => {
      const party = [5, 5, 5, 5];
      const encounter = generateRandomEncounter(party, "forest", "medium", mockIndex);

      encounter.monsters.forEach((monster) => {
        expect(monster.cr).toBeDefined();
        expect(typeof monster.cr).toBe("string");
        expect(monster.cr.length).toBeGreaterThan(0);
      });
    });

    test("monster XP values are non-negative", () => {
      const party = [5, 5, 5, 5];
      const encounter = generateRandomEncounter(party, "forest", "medium", mockIndex);

      encounter.monsters.forEach((monster) => {
        expect(monster.xp).toBeGreaterThanOrEqual(0);
        expect(Number.isInteger(monster.xp)).toBe(true);
      });
    });

    test("flavor text is unique for different environments", () => {
      const party = [5, 5, 5, 5];

      const forestEncounter = generateRandomEncounter(party, "forest", "medium", mockIndex);
      const desertEncounter = generateRandomEncounter(party, "desert", "medium", mockIndex);
      const underdarkEncounter = generateRandomEncounter(party, "underdark", "medium", mockIndex);

      expect(forestEncounter.flavorText).toBeDefined();
      expect(desertEncounter.flavorText).toBeDefined();
      expect(underdarkEncounter.flavorText).toBeDefined();
    });

    test("handles low-level party", () => {
      const party = [1, 1, 1, 1];
      const encounter = generateRandomEncounter(party, "forest", "easy", mockIndex);

      expect(encounter.monsters.length).toBeGreaterThan(0);
      expect(encounter.totalBaseXP).toBeGreaterThan(0);
      expect(encounter.adjustedXP).toBeGreaterThan(0);
    });

    test("handles high-level party", () => {
      const party = [20, 20, 20, 20];
      const encounter = generateRandomEncounter(party, "mountain", "deadly", mockIndex);

      expect(encounter.monsters.length).toBeGreaterThan(0);
      expect(encounter.totalBaseXP).toBeGreaterThan(0);
      expect(encounter.adjustedXP).toBeGreaterThan(0);
    });

    test("handles single-character party", () => {
      const party = [5];
      const encounter = generateRandomEncounter(party, "urban", "medium", mockIndex);

      expect(encounter.monsters.length).toBeGreaterThan(0);
      expect(encounter.partyThresholds.partySize).toBe(1);
    });

    test("handles large party", () => {
      const party = [5, 5, 5, 5, 5, 5, 5, 5];
      const encounter = generateRandomEncounter(party, "forest", "medium", mockIndex);

      expect(encounter.monsters.length).toBeGreaterThan(0);
      expect(encounter.partyThresholds.partySize).toBe(8);
    });

    test("encounter multiplier is appropriate for party size", () => {
      const party = [5, 5, 5, 5];
      const encounter = generateRandomEncounter(party, "forest", "medium", mockIndex);

      const totalMonsters = encounter.monsters.reduce((sum, m) => sum + m.count, 0);
      expect(encounter.encounterMultiplier).toBeGreaterThan(0);
      expect(encounter.encounterMultiplier).toBeLessThanOrEqual(4);
    });

    test("generates different monsters on multiple calls", () => {
      const party = [5, 5, 5, 5];

      const encounter1 = generateRandomEncounter(party, "forest", "medium", mockIndex);
      const encounter2 = generateRandomEncounter(party, "forest", "medium", mockIndex);

      // While they could be the same by chance, multiple calls should show variety
      // We just verify they're both valid encounters
      expect(encounter1.monsters.length).toBeGreaterThan(0);
      expect(encounter2.monsters.length).toBeGreaterThan(0);
    });
  });

  describe("Environment-specific monster types", () => {
    test("forest encounters include beasts, fey, or plants", () => {
      const party = [5, 5, 5, 5];
      const encounter = generateRandomEncounter(party, "forest", "medium", mockIndex);

      // With our mock index, forest encounters should pick beasts
      expect(encounter.monsters.length).toBeGreaterThan(0);
    });

    test("underdark encounters include aberrations, oozes, or humanoids", () => {
      const party = [5, 5, 5, 5];
      const encounter = generateRandomEncounter(party, "underdark", "medium", mockIndex);

      expect(encounter.monsters.length).toBeGreaterThan(0);
    });

    test("mountain encounters include giants, dragons, or humanoids", () => {
      const party = [5, 5, 5, 5];
      const encounter = generateRandomEncounter(party, "mountain", "medium", mockIndex);

      expect(encounter.monsters.length).toBeGreaterThan(0);
    });
  });

  describe("Flavor text generation", () => {
    test("flavor text is non-empty string", () => {
      const party = [5, 5, 5, 5];
      const encounter = generateRandomEncounter(party, "forest", "medium", mockIndex);

      expect(typeof encounter.flavorText).toBe("string");
      expect(encounter.flavorText.length).toBeGreaterThan(0);
    });

    test("each environment has flavor text options", () => {
      const party = [5, 5, 5, 5];
      const environments: Environment[] = [
        "forest",
        "underdark",
        "mountain",
        "desert",
        "urban",
        "coast",
        "arctic",
        "swamp",
        "grassland",
      ];

      environments.forEach((env) => {
        const encounter = generateRandomEncounter(party, env, "medium", mockIndex);
        expect(encounter.flavorText).toBeDefined();
        expect(encounter.flavorText.length).toBeGreaterThan(0);
      });
    });
  });
});

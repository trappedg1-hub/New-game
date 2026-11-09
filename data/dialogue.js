/* ============ DIALOGUE: tier lines, costume lines, events ============ */
window.DIALOGUE = (() => {
  const TIERS = {
    1: ["Please don't stare...", "I'm only here because it's quiet.", "We're not close enough for that.",
        "You came again...?", "Don't read into this.", "Stand over there, please."],
    2: ["You're back again~", "I saved you a seat, dummy.", "Your hair's messy. Here—hold still.",
        "Today felt less boring with you around.", "Don't tell anyone I smile this much.",
        "Want to walk home together?"],
    3: ["Like what you see?", "Race you to the pool!", "The water's perfect today.",
        "Don't forget your sunscreen.", "Let's try the deep end together.", "Summer looks good on us."],
    4: ["Come sit next to me...", "The night's still young, you know.", "Touch my hand — it's warm, right?",
        "Stay until the city goes quiet.", "You can look. I don't mind anymore.",
        "Sleep here tonight... please?"],
    5: ["I'm yours forever.", "Every version of me chooses you.", "Say it again — I love hearing it.",
        "No more hiding. I'm all yours.", "Where you go, I go.", "Promise you'll never let go."],
  };

  const BOOT = "...you came back. Don't just stand there.";
  const PRESTIGE = "It's... really okay? Then — from the start. But closer this time.";

  const COSTUME_LINES = {
    track:   "Warm-up first! No slacking~",
    apron:   "One cocoa, extra marshmallows. For you.",
    maid:    "Welcome home, Master... f-fine, I'll stop teasing.",
    pool:    "Sunscreen. Now. Don't make me ask twice.",
    gown:    "Do you like the silk better than me? ...Kidding. Mostly.",
    bunny:   "D-don't stare at the ears! ...You may stare a little.",
    cardigan:"It's cold out... stay a little closer? Just a little.",
    base:    null,
  };

  const TIER_UP_TEXT = {
    2: "She waves you over from the corner table.",
    3: "Sunlight dances across the private pool.",
    4: "Warm lamplight. A quiet room, just for you two.",
    5: "Salt wind, sunset gold — she reaches for your hand.",
  };

  const lines = id => TIERS[id] || TIERS[1];
  const pick = id => { const a = lines(id); return a[Math.floor(Math.random()*a.length)]; };

  return { TIERS, BOOT, PRESTIGE, COSTUME_LINES, TIER_UP_TEXT, lines, pick };
})();

import { NoteData } from '../ui/Journal';

// The narrative spine, delivered in fragments. Notes left by previous wanderers
// and a "M.E.G."-style explorer group hint at the way down and the way out.
// Three Level-2 notes carry the valve codes for the exit puzzle.

export const VALVE_CODES = ['7', '3', '9']; // red, blue, green

export const NOTES_BY_LEVEL: NoteData[][] = [
  // ── Level 0 ──────────────────────────────────────────────────────────────
  [
    {
      id: 'l0-1', title: 'scrap of paper', meta: 'found · Level 0',
      body: [
        'if you are reading this you noclipped too. don\'t panic. the rooms go on forever but they aren\'t random — there are <em>weak points</em>.',
        'look for wallpaper that\'s wrong. a patch that shimmers, that hums a different note. push through it. it takes you <em>down</em>.',
      ],
      sig: '— scratched in pencil',
    },
    {
      id: 'l0-2', title: 'M.E.G. notice', meta: 'found · Level 0',
      body: [
        'M.E.G. ADVISORY // LEVEL 0 "THE LOBBY"',
        'Drink Almond Water to stay lucid. Ration it. Sanity loss in here is slow but it does not stop.',
        'You are not being hunted on this level. That changes below. Keep your light working.',
      ],
      sig: '— Major Explorer Group, posting #114',
    },
    {
      id: 'l0-3', title: 'torn page', meta: 'found · Level 0',
      body: [
        'day ?? — I keep walking and the carpet keeps being damp and the lights keep buzzing and I have not seen a door in so long.',
        'I think it learns the sound of your footsteps. I have started taking my shoes off.',
      ],
      sig: '— unsigned',
    },
  ],
  // ── Level 1 ──────────────────────────────────────────────────────────────
  [
    {
      id: 'l1-1', title: 'dock manifest', meta: 'found · Level 1',
      body: [
        'LEVEL 1 "HABITABLE ZONE" — the warehouse. there is a loading dock. that is the way to Pipe Dreams below.',
        'the thing here only moves in the dark. when the fluorescents cut out, <em>stop</em>. do not run. it follows motion and sound.',
      ],
      sig: '— M.E.G. posting #220',
    },
    {
      id: 'l1-2', title: 'water-stained note', meta: 'found · Level 1',
      body: [
        'crouch in the racks when the lights go. it can\'t reach into the low spaces. I waited out three blackouts that way.',
        'it is thin. wrong-thin. like a person drawn by someone who only had the idea of a person described to them.',
      ],
      sig: '— H.',
    },
    {
      id: 'l1-3', title: 'last entry', meta: 'found · Level 1',
      body: [
        'found the vent to the pipes. going down. if anyone finds this — the exit from Pipe Dreams needs three valves, and the valves need codes.',
        'we split the codes across three notes so it couldn\'t take all of them at once. find them. red, then blue, then green.',
      ],
      sig: '— H., final page',
    },
  ],
  // ── Level 2 ──────────────────────────────────────────────────────────────
  [
    {
      id: 'l2-1', title: 'valve note — RED', meta: 'found · Level 2',
      body: ['the RED valve.', 'turn it to <strong>SEVEN</strong>. (7)', 'two more after this. keep moving, keep your light low.'],
      sig: '— M.E.G. exit protocol 1/3',
    },
    {
      id: 'l2-2', title: 'valve note — BLUE', meta: 'found · Level 2',
      body: ['the BLUE valve.', 'turn it to <strong>THREE</strong>. (3)', 'I can hear it in the pipes with us. hurry.'],
      sig: '— M.E.G. exit protocol 2/3',
    },
    {
      id: 'l2-3', title: 'valve note — GREEN', meta: 'found · Level 2',
      body: ['the GREEN valve.', 'turn it to <strong>NINE</strong>. (9)', 'all three open the door to the Frontrooms. it is real. I have seen the daylight through the gap.'],
      sig: '— M.E.G. exit protocol 3/3',
    },
    {
      id: 'l2-4', title: 'pinned photograph', meta: 'found · Level 2',
      body: [
        'a faded photo of an ordinary office. a window. grey daylight. a coffee cup.',
        'on the back, in shaking ink: "this is what we are trying to get back to. don\'t forget it looks like this."',
      ],
      sig: '',
    },
  ],
];

export const ENDINGS = {
  good: {
    title: 'THE FRONTROOMS',
    body: 'The valves groan. A door that should not exist swings into grey daylight, ordinary and impossible. You step through, and the hum finally — finally — stops. You are out. You think.',
  },
  bad_sanity: {
    title: 'LOST FOREVER',
    body: 'Your mind lets go of the last thread. The walls breathe. The light becomes a sound and the sound becomes a hallway and you walk into it and you do not come back. The rooms keep you now.',
  },
};

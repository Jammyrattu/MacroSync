/**
 * How-to guide for each entry in EXERCISES: a short set of cues plus a demo.
 *
 * The demo frames come from the Free Exercise DB (https://github.com/yuhonas/
 * free-exercise-db), which is released into the public domain under The
 * Unlicense. Every exercise there ships exactly two photographs — the start and
 * end of the movement — so the UI alternates them to animate the rep rather
 * than shipping video.
 *
 * `demo` is that dataset's folder name, and is null where it has no equivalent
 * movement; the detail view then shows the cues on their own. The steps below
 * are written for this app, not taken from the dataset.
 */

export interface ExerciseGuide {
  /** Free Exercise DB folder name, or null when no demo exists for it. */
  demo: string | null
  steps: string[]
}

/** Pinned to a commit so a change upstream can't silently swap the images. */
const DB_COMMIT = 'b0eed061e1c832b3ed815fbaa4b45b3cdc14df49'

/** The two frames of a movement, oldest-to-newest, or null when there's no demo. */
export function demoFrames(demo: string | null): [string, string] | null {
  if (!demo) return null
  const base = `https://cdn.jsdelivr.net/gh/yuhonas/free-exercise-db@${DB_COMMIT}/exercises/${demo}`
  return [`${base}/0.jpg`, `${base}/1.jpg`]
}

export const EXERCISE_GUIDES: Record<string, ExerciseGuide> = {
  // ---- Chest ----
  'bench-press': {
    demo: 'Barbell_Bench_Press_-_Medium_Grip',
    steps: [
      'Lie flat with your eyes under the bar and plant both feet.',
      'Grip slightly wider than shoulder-width, wrists stacked over elbows.',
      'Unrack, then lower the bar under control to mid-chest.',
      'Keep your elbows about 45° from your body — not flared straight out.',
      'Press back up until your arms are locked, without bouncing off your chest.',
    ],
  },
  'incline-bench-press': {
    demo: 'Barbell_Incline_Bench_Press_-_Medium_Grip',
    steps: [
      'Set the bench to roughly 30° — steeper shifts the work to your shoulders.',
      'Grip slightly wider than shoulder-width and unrack.',
      'Lower the bar to your upper chest, just below the collarbone.',
      'Press up and slightly back, finishing over your shoulders.',
    ],
  },
  'decline-bench-press': {
    demo: 'Decline_Barbell_Bench_Press',
    steps: [
      'Secure your legs in the pads before unracking.',
      'Grip slightly wider than shoulder-width.',
      'Lower the bar to your lower chest under control.',
      'Press back up to locked arms, keeping your head down on the bench.',
    ],
  },
  'db-bench-press': {
    demo: 'Dumbbell_Bench_Press',
    steps: [
      'Sit with the dumbbells on your thighs, then kick them up as you lie back.',
      'Start with the weights at chest level, palms facing forward.',
      'Press up until your arms are straight, letting the dumbbells drift together.',
      'Lower slowly until you feel a stretch across your chest.',
    ],
  },
  'incline-db-press': {
    demo: 'Incline_Dumbbell_Press',
    steps: [
      'Set the bench to about 30° and sit back with the dumbbells on your thighs.',
      'Start at upper-chest level with palms facing forward.',
      'Press up and slightly inward until your arms lock out.',
      'Lower under control until your elbows sit just below shoulder height.',
    ],
  },
  'db-fly': {
    demo: 'Dumbbell_Flyes',
    steps: [
      'Lie flat holding the dumbbells above your chest, palms facing each other.',
      'Keep a soft, fixed bend in your elbows for the whole set.',
      'Open your arms in a wide arc until you feel a stretch across your chest.',
      'Bring them back together along the same arc — hug, don’t press.',
      'Use a lighter weight than you would for a press; this is a stretch, not a lift.',
    ],
  },
  'cable-crossover': {
    demo: 'Cable_Crossover',
    steps: [
      'Set both pulleys high and take a handle in each hand.',
      'Step forward into a split stance with a slight forward lean.',
      'Keep a soft bend in the elbows and sweep your hands down and together.',
      'Cross slightly at the bottom, squeeze, then return slowly.',
    ],
  },
  'pec-deck': {
    demo: 'Butterfly',
    steps: [
      'Set the seat so the handles sit at chest height.',
      'Sit back with your shoulders down and your back against the pad.',
      'Bring the handles together in front of your chest and squeeze.',
      'Return slowly until you feel a stretch, without letting the weights touch down.',
    ],
  },
  'push-up': {
    demo: 'Pushups',
    steps: [
      'Set your hands slightly wider than your shoulders.',
      'Brace your abs and glutes so your body is one straight line.',
      'Lower until your chest is just above the floor, elbows about 45°.',
      'Press back up without letting your hips sag or pike.',
    ],
  },
  'dips-chest': {
    demo: 'Dips_-_Chest_Version',
    steps: [
      'Support yourself on the bars with your arms locked.',
      'Lean your torso forward — that’s what shifts the work to your chest.',
      'Lower until your upper arms are roughly parallel to the floor.',
      'Press back up, keeping the forward lean throughout.',
      'Stop short if you feel it pinch at the front of the shoulder.',
    ],
  },
  'machine-chest-press': {
    demo: 'Leverage_Chest_Press',
    steps: [
      'Set the seat so the handles line up with the middle of your chest.',
      'Sit back with your shoulders down and pinned to the pad.',
      'Press forward until your arms are straight but not locked hard.',
      'Return under control until your hands are level with your chest.',
    ],
  },

  // ---- Back ----
  deadlift: {
    demo: 'Barbell_Deadlift',
    steps: [
      'Stand with the bar over your mid-foot, feet about hip-width.',
      'Hinge and grip just outside your knees; shins lightly touch the bar.',
      'Set your chest up and pull the slack out of the bar before you lift.',
      'Drive through the floor, keeping the bar dragging up your legs.',
      'Lock out by standing tall — don’t lean back at the top.',
    ],
  },
  'sumo-deadlift': {
    demo: 'Sumo_Deadlift',
    steps: [
      'Take a wide stance with your toes turned out, bar over mid-foot.',
      'Grip inside your knees with your arms hanging straight down.',
      'Drop your hips, open your knees out over your toes, chest up.',
      'Push the floor apart and stand, keeping the bar close.',
    ],
  },
  'romanian-deadlift': {
    demo: 'Romanian_Deadlift',
    steps: [
      'Start standing with the bar at your hips, knees softly bent.',
      'Push your hips backwards and let the bar slide down your thighs.',
      'Stop when you feel a strong stretch in your hamstrings — usually mid-shin.',
      'Keep your back flat the whole way; the knees barely move.',
      'Drive your hips forward to stand back up.',
    ],
  },
  'pull-up': {
    demo: 'Pullups',
    steps: [
      'Grip the bar just wider than your shoulders, palms facing away.',
      'Start from a full hang, then pull your shoulder blades down first.',
      'Drive your elbows to your ribs until your chin clears the bar.',
      'Lower all the way under control rather than dropping.',
    ],
  },
  'chin-up': {
    demo: 'Chin-Up',
    steps: [
      'Grip the bar shoulder-width with your palms facing you.',
      'Hang fully, then pull your chest towards the bar.',
      'Keep your elbows tucked in front of you as you rise.',
      'Lower slowly to a full hang between reps.',
    ],
  },
  'lat-pulldown': {
    demo: 'Wide-Grip_Lat_Pulldown',
    steps: [
      'Set the thigh pad so you stay seated when the weight gets heavy.',
      'Grip wider than shoulder-width and lean back very slightly.',
      'Pull the bar to your upper chest, leading with your elbows.',
      'Squeeze your shoulder blades together, then return with control.',
      'Don’t pull behind your neck — it stresses the shoulder for no extra benefit.',
    ],
  },
  'barbell-row': {
    demo: 'Bent_Over_Barbell_Row',
    steps: [
      'Hinge forward to roughly 45° with a flat back and soft knees.',
      'Grip just outside your knees, arms hanging straight down.',
      'Pull the bar to your lower ribs, elbows going back not out.',
      'Lower under control without letting your torso rise.',
    ],
  },
  'pendlay-row': {
    demo: null,
    steps: [
      'Set up like a bent-over row but with your torso parallel to the floor.',
      'The bar starts on the floor and returns to it every rep.',
      'Pull explosively to your lower chest, keeping your back flat and still.',
      'Reset the bar on the floor between reps — no bouncing.',
    ],
  },
  'db-row': {
    demo: 'One-Arm_Dumbbell_Row',
    steps: [
      'Put one knee and the same-side hand on a bench, back flat.',
      'Let the dumbbell hang straight down from your free arm.',
      'Pull it to your hip, driving your elbow past your ribs.',
      'Lower all the way to a full stretch, keeping your shoulders level.',
    ],
  },
  'seated-cable-row': {
    demo: 'Seated_Cable_Rows',
    steps: [
      'Sit with a slight knee bend and your chest tall.',
      'Start with your arms extended and shoulder blades stretched forward.',
      'Pull the handle to your navel, elbows brushing your sides.',
      'Squeeze your shoulder blades, then extend slowly without slumping.',
    ],
  },
  't-bar-row': {
    demo: 'T-Bar_Row_with_Handle',
    steps: [
      'Straddle the bar and hinge forward with a flat back.',
      'Take the handle with both hands and let it hang.',
      'Row towards your stomach, keeping your elbows close.',
      'Lower to a full stretch without rounding your lower back.',
    ],
  },
  'face-pull': {
    demo: 'Face_Pull',
    steps: [
      'Set a rope attachment at roughly head height.',
      'Take an overhand grip and step back until the cable is tight.',
      'Pull the rope towards your forehead, splitting your hands apart.',
      'Finish with your knuckles by your ears and elbows high.',
      'Go light — this is a control exercise for the rear shoulder.',
    ],
  },
  'straight-arm-pulldown': {
    demo: 'Straight-Arm_Pulldown',
    steps: [
      'Stand facing a high pulley with a bar or rope, arms extended.',
      'Hinge forward slightly and lock a soft bend into your elbows.',
      'Sweep the bar down in an arc until it reaches your thighs.',
      'Return slowly overhead, feeling the stretch through your lats.',
    ],
  },

  // ---- Shoulders ----
  'overhead-press': {
    demo: 'Standing_Military_Press',
    steps: [
      'Start with the bar on your front shoulders, grip just outside shoulder-width.',
      'Squeeze your glutes and brace so you don’t lean back.',
      'Press straight up, moving your head back slightly to clear the bar.',
      'Lock out with the bar over your mid-foot, ears in front of your arms.',
      'Lower under control back to your shoulders.',
    ],
  },
  'seated-db-press': {
    demo: 'Seated_Dumbbell_Press',
    steps: [
      'Sit with your back against an upright bench, feet planted.',
      'Start with the dumbbells at ear height, palms forward.',
      'Press up and slightly together until your arms lock.',
      'Lower under control until your elbows are just below shoulder height.',
    ],
  },
  'arnold-press': {
    demo: 'Arnold_Dumbbell_Press',
    steps: [
      'Start with the dumbbells in front of your chest, palms facing you.',
      'As you press, rotate your palms to face forward.',
      'Finish locked out overhead with the weights slightly together.',
      'Reverse the rotation on the way down — smooth, not rushed.',
    ],
  },
  'lateral-raise': {
    demo: 'Side_Lateral_Raise',
    steps: [
      'Stand with the dumbbells at your sides, elbows slightly bent.',
      'Raise your arms out to the sides until they reach shoulder height.',
      'Lead with your elbows, not your hands.',
      'Lower slowly — most of the benefit is on the way down.',
      'Use light weight; swinging turns this into a shrug.',
    ],
  },
  'cable-lateral-raise': {
    demo: 'Cable_Seated_Lateral_Raise',
    steps: [
      'Set the pulley to its lowest point and stand side-on.',
      'Take the handle in the outside hand, across your body.',
      'Raise your arm out to the side to shoulder height.',
      'Lower slowly against the cable’s pull, keeping tension throughout.',
    ],
  },
  'front-raise': {
    demo: 'Front_Dumbbell_Raise',
    steps: [
      'Hold the dumbbells in front of your thighs, palms facing you.',
      'Raise one or both arms straight out in front to shoulder height.',
      'Keep your torso still — no rocking to get the weight up.',
      'Lower under control to the start.',
    ],
  },
  'rear-delt-fly': {
    demo: 'Reverse_Flyes',
    steps: [
      'Hinge forward until your chest is near parallel to the floor.',
      'Let the dumbbells hang below you, elbows slightly bent.',
      'Open your arms out to the sides, squeezing your shoulder blades.',
      'Stop at shoulder height, then lower slowly.',
    ],
  },
  'upright-row': {
    demo: 'Upright_Barbell_Row',
    steps: [
      'Grip the bar at about shoulder-width — narrower can pinch the shoulder.',
      'Pull the bar up the front of your body, leading with your elbows.',
      'Stop when your upper arms reach shoulder height.',
      'Lower under control; stop the set if you feel any shoulder pinch.',
    ],
  },
  'barbell-shrug': {
    demo: 'Barbell_Shrug',
    steps: [
      'Hold the bar at arm’s length in front of your thighs.',
      'Shrug straight up towards your ears, arms staying straight.',
      'Pause briefly at the top and squeeze.',
      'Lower fully — don’t roll your shoulders.',
    ],
  },
  'machine-shoulder-press': {
    demo: 'Machine_Shoulder_Military_Press',
    steps: [
      'Set the seat so the handles start at about ear height.',
      'Sit back with your back flat against the pad.',
      'Press up until your arms are straight but not locked hard.',
      'Lower under control to the starting height.',
    ],
  },

  // ---- Arms ----
  'barbell-curl': {
    demo: 'Barbell_Curl',
    steps: [
      'Stand with the bar at arm’s length, palms facing forward.',
      'Keep your elbows pinned at your sides throughout.',
      'Curl the bar up to shoulder height without swinging.',
      'Lower slowly to a full stretch at the bottom.',
    ],
  },
  'ez-bar-curl': {
    demo: 'EZ-Bar_Curl',
    steps: [
      'Take the angled part of the bar — it’s easier on the wrists.',
      'Keep your elbows tight to your ribs.',
      'Curl up to shoulder height, squeezing at the top.',
      'Lower under control until your arms are straight.',
    ],
  },
  'db-curl': {
    demo: 'Dumbbell_Bicep_Curl',
    steps: [
      'Stand with the dumbbells at your sides, palms facing forward.',
      'Curl one or both up, keeping your elbows still.',
      'Squeeze at the top without swinging your shoulders forward.',
      'Lower all the way down before the next rep.',
    ],
  },
  'hammer-curl': {
    demo: 'Alternate_Hammer_Curl',
    steps: [
      'Hold the dumbbells with palms facing each other, like holding hammers.',
      'Keep that neutral grip for the whole rep.',
      'Curl up towards your shoulder, elbow staying at your side.',
      'Lower under control, then repeat on the other arm.',
    ],
  },
  'incline-db-curl': {
    demo: 'Incline_Dumbbell_Curl',
    steps: [
      'Set a bench to about 60° and sit back with your arms hanging.',
      'Let the dumbbells stretch behind your torso — that’s the point of the angle.',
      'Curl up without letting your elbows drift forward.',
      'Lower all the way back to the stretch.',
    ],
  },
  'preacher-curl': {
    demo: 'Preacher_Curl',
    steps: [
      'Set the seat so your armpits rest on the top of the pad.',
      'Rest the backs of your arms flat against the pad.',
      'Curl up to just short of vertical, where tension drops off.',
      'Lower slowly — never let the weight snap your elbows straight.',
    ],
  },
  'concentration-curl': {
    demo: 'Concentration_Curls',
    steps: [
      'Sit and brace the back of your upper arm against your inner thigh.',
      'Let the dumbbell hang at a full stretch.',
      'Curl up towards your opposite shoulder, squeezing hard at the top.',
      'Lower slowly and repeat before switching arms.',
    ],
  },
  'cable-curl': {
    demo: 'Standing_Biceps_Cable_Curl',
    steps: [
      'Set the pulley low and stand a step back from the machine.',
      'Keep your elbows at your sides and your torso upright.',
      'Curl the bar to shoulder height against constant cable tension.',
      'Lower slowly without letting the stack touch down.',
    ],
  },
  'tricep-pushdown': {
    demo: 'Triceps_Pushdown',
    steps: [
      'Set the pulley high and grip the bar with palms down.',
      'Tuck your elbows against your ribs and lean in very slightly.',
      'Push down until your arms are fully straight.',
      'Let the bar rise to about 90° — no further, or your elbows drift.',
    ],
  },
  'rope-pushdown': {
    demo: 'Triceps_Pushdown_-_Rope_Attachment',
    steps: [
      'Set the pulley high and take a rope with a neutral grip.',
      'Keep your elbows pinned at your sides.',
      'Push down and split the rope apart at the bottom.',
      'Return under control to about 90° at the elbow.',
    ],
  },
  'skull-crusher': {
    demo: 'EZ-Bar_Skullcrusher',
    steps: [
      'Lie on a flat bench holding an EZ-bar above your chest.',
      'Keep your upper arms still and angled slightly back.',
      'Bend at the elbows to lower the bar towards your forehead.',
      'Extend back up without letting your elbows flare wide.',
    ],
  },
  'overhead-tricep-ext': {
    demo: 'Standing_Dumbbell_Triceps_Extension',
    steps: [
      'Hold one dumbbell overhead with both hands, arms straight.',
      'Keep your elbows pointing forward and close to your head.',
      'Lower the weight behind your head until you feel a stretch.',
      'Extend back to straight without letting your ribs flare.',
    ],
  },
  'close-grip-bench': {
    demo: 'Close-Grip_Barbell_Bench_Press',
    steps: [
      'Grip the bar at about shoulder-width — no narrower.',
      'Lower to your lower chest with your elbows tucked close.',
      'Keep your wrists stacked over your elbows.',
      'Press back up, driving through your triceps.',
    ],
  },
  'tricep-dip': {
    demo: 'Dips_-_Triceps_Version',
    steps: [
      'Support yourself on the bars with your torso upright.',
      'Keep your elbows pointing straight back, not out.',
      'Lower until your upper arms are about parallel to the floor.',
      'Press back to locked arms, staying tall throughout.',
    ],
  },

  // ---- Legs ----
  'back-squat': {
    demo: 'Barbell_Squat',
    steps: [
      'Set the bar across your upper back, not on your neck.',
      'Unrack, step back, and set your feet about shoulder-width, toes slightly out.',
      'Brace your core, then sit down and back, knees tracking over your toes.',
      'Descend to at least parallel if your hips allow it.',
      'Drive up through your mid-foot, keeping your chest up.',
    ],
  },
  'front-squat': {
    demo: 'Front_Barbell_Squat',
    steps: [
      'Rest the bar on your front shoulders with your elbows high.',
      'Keep your elbows up for the whole rep — dropping them dumps the bar.',
      'Sit straight down with an upright torso.',
      'Drive back up without letting your chest fall forward.',
    ],
  },
  'goblet-squat': {
    demo: 'Goblet_Squat',
    steps: [
      'Hold a dumbbell or kettlebell against your chest with both hands.',
      'Stand a little wider than shoulder-width, toes slightly out.',
      'Squat down between your knees, keeping your chest tall.',
      'Push the floor away to stand, keeping the weight close.',
    ],
  },
  'hack-squat': {
    demo: 'Hack_Squat',
    steps: [
      'Set your shoulders under the pads and your feet mid-platform.',
      'Release the safeties and take the weight.',
      'Lower until your knees reach about 90°.',
      'Press back up without locking your knees hard at the top.',
    ],
  },
  'leg-press': {
    demo: 'Leg_Press',
    steps: [
      'Sit back fully so your lower back stays flat against the pad.',
      'Place your feet shoulder-width in the middle of the platform.',
      'Lower until your knees reach about 90°, keeping your hips down.',
      'Press back up without locking your knees out hard.',
    ],
  },
  'bulgarian-split-squat': {
    demo: 'Split_Squat_with_Dumbbells',
    steps: [
      'Rest the top of your back foot on a bench behind you.',
      'Step the front foot far enough forward to keep the knee behind the toes.',
      'Lower straight down until your back knee nearly touches the floor.',
      'Drive up through your front heel; finish all reps before swapping.',
    ],
  },
  'walking-lunge': {
    demo: 'Barbell_Walking_Lunge',
    steps: [
      'Stand tall holding the weight at your sides or on your back.',
      'Step forward and lower until both knees are at about 90°.',
      'Push off your back foot and step straight into the next lunge.',
      'Keep your torso upright and your steps in a straight line.',
    ],
  },
  'reverse-lunge': {
    demo: 'Dumbbell_Rear_Lunge',
    steps: [
      'Stand tall with the weights at your sides.',
      'Step backwards and lower until both knees reach about 90°.',
      'Keep most of your weight on the front leg.',
      'Push through the front heel to return to standing.',
    ],
  },
  'step-up': {
    demo: 'Dumbbell_Step_Ups',
    steps: [
      'Pick a box that puts your thigh roughly parallel when you step up.',
      'Place one whole foot on the box.',
      'Drive through that heel to stand up — don’t push off the back foot.',
      'Lower back down under control rather than dropping.',
    ],
  },
  'leg-extension': {
    demo: 'Leg_Extensions',
    steps: [
      'Set the pad so it sits on your shins just above your ankles.',
      'Line the machine’s pivot up with your knee joint.',
      'Extend until your legs are straight and squeeze briefly.',
      'Lower slowly without letting the weights slam down.',
    ],
  },
  'lying-leg-curl': {
    demo: 'Lying_Leg_Curls',
    steps: [
      'Lie face down with the pad just above your heels.',
      'Hold the handles and keep your hips pressed into the bench.',
      'Curl your heels towards your glutes as far as they’ll go.',
      'Lower slowly to a full stretch.',
    ],
  },
  'seated-leg-curl': {
    demo: 'Seated_Leg_Curl',
    steps: [
      'Set the lap pad snug so you stay in the seat.',
      'Place the pad against the backs of your lower calves.',
      'Curl your heels down and under, squeezing your hamstrings.',
      'Return slowly to straight legs.',
    ],
  },
  'hip-thrust': {
    demo: 'Barbell_Hip_Thrust',
    steps: [
      'Sit with your upper back against a bench and the bar over your hips.',
      'Plant your feet so your shins are vertical at the top.',
      'Drive through your heels and squeeze your glutes to lift the bar.',
      'Finish with your torso parallel to the floor and your ribs down.',
      'Lower under control without resting the bar on the floor.',
    ],
  },
  'standing-calf-raise': {
    demo: 'Standing_Calf_Raises',
    steps: [
      'Stand with the balls of your feet on the platform, heels hanging off.',
      'Drop your heels below the step for a full stretch.',
      'Press up onto your toes as high as you can.',
      'Pause at the top, then lower slowly — don’t bounce.',
    ],
  },
  'seated-calf-raise': {
    demo: 'Seated_Calf_Raise',
    steps: [
      'Sit with the pad across your lower thighs, balls of your feet on the step.',
      'Release the safety and let your heels drop for a stretch.',
      'Press up onto your toes as far as the machine allows.',
      'Pause at the top, then lower slowly.',
    ],
  },
  'good-morning': {
    demo: 'Good_Morning',
    steps: [
      'Set a light bar across your upper back and unrack it.',
      'Soften your knees and brace your core hard.',
      'Push your hips back and hinge forward with a flat back.',
      'Stop when your hamstrings tighten, then drive your hips forward to stand.',
      'Start much lighter than you think — this one punishes ego.',
    ],
  },

  // ---- Core ----
  plank: {
    demo: 'Plank',
    steps: [
      'Rest on your forearms with your elbows under your shoulders.',
      'Extend your legs and come up onto your toes.',
      'Squeeze your glutes and abs so your body is one straight line.',
      'Don’t let your hips sag or pike up — hold and breathe steadily.',
    ],
  },
  'side-plank': {
    demo: 'Side_Bridge',
    steps: [
      'Lie on your side with your elbow directly under your shoulder.',
      'Stack your feet and lift your hips off the floor.',
      'Form a straight line from ankles to head.',
      'Hold, then repeat on the other side for the same time.',
    ],
  },
  crunch: {
    demo: 'Crunches',
    steps: [
      'Lie on your back with your knees bent and feet flat.',
      'Rest your hands by your ears without pulling on your neck.',
      'Curl your shoulders up off the floor, ribs towards hips.',
      'Lower slowly — this is a short movement, not a full sit-up.',
    ],
  },
  'bicycle-crunch': {
    demo: 'Air_Bike',
    steps: [
      'Lie on your back with your hands lightly by your ears.',
      'Lift your shoulders and bring both knees up.',
      'Rotate one elbow towards the opposite knee as the other leg extends.',
      'Alternate smoothly — control beats speed here.',
    ],
  },
  'hanging-leg-raise': {
    demo: 'Hanging_Leg_Raise',
    steps: [
      'Hang from a bar with your arms straight and shoulders engaged.',
      'Without swinging, raise your legs until your hips curl up.',
      'Pause at the top rather than using momentum.',
      'Lower slowly and fully between reps.',
    ],
  },
  'lying-leg-raise': {
    demo: 'Flat_Bench_Lying_Leg_Raise',
    steps: [
      'Lie flat and tuck your hands under your hips for support.',
      'Press your lower back into the floor or bench.',
      'Raise your legs to vertical, keeping them nearly straight.',
      'Lower slowly and stop before your back arches off.',
    ],
  },
  'russian-twist': {
    demo: 'Russian_Twist',
    steps: [
      'Sit with your knees bent and lean back to about 45°.',
      'Hold a weight at your chest, feet lifted if you can.',
      'Rotate your torso to tap the weight beside one hip.',
      'Rotate to the other side — turn your shoulders, not just your arms.',
    ],
  },
  'cable-crunch': {
    demo: 'Cable_Crunch',
    steps: [
      'Kneel below a high pulley holding a rope beside your head.',
      'Keep your hips fixed — they shouldn’t move at all.',
      'Curl your ribs down towards your knees, rounding your upper back.',
      'Return slowly against the weight.',
    ],
  },
  'ab-wheel': {
    demo: 'Ab_Roller',
    steps: [
      'Kneel with the wheel under your shoulders.',
      'Brace your abs and squeeze your glutes before you move.',
      'Roll forward only as far as you can go without your hips sagging.',
      'Pull back using your abs, not your arms.',
      'Shorten the range if your lower back starts to arch.',
    ],
  },
  'mountain-climber': {
    demo: 'Mountain_Climbers',
    steps: [
      'Start in a push-up position with your hands under your shoulders.',
      'Drive one knee towards your chest.',
      'Switch legs quickly, keeping your hips low and level.',
      'Keep your shoulders stacked over your hands throughout.',
    ],
  },
  'dead-bug': {
    demo: 'Dead_Bug',
    steps: [
      'Lie on your back with arms up and knees bent at 90°.',
      'Press your lower back flat into the floor and keep it there.',
      'Lower one arm and the opposite leg towards the floor.',
      'Return and swap sides — stop as soon as your back lifts.',
    ],
  },

  // ---- Cardio ----
  'treadmill-run': {
    demo: 'Running_Treadmill',
    steps: [
      'Start with a few minutes of walking to warm up.',
      'Build to your target pace rather than jumping straight in.',
      'Stay in the middle of the belt and look ahead, not down.',
      'Keep your steps light and let your arms swing naturally.',
      'Finish with a slow walk to bring your heart rate down.',
    ],
  },
  'outdoor-run': {
    demo: null,
    steps: [
      'Start with five minutes of easy jogging to warm up.',
      'Hold a pace where you could still speak in short sentences.',
      'Keep your steps light and land under your body, not out in front.',
      'Stay relaxed through the shoulders and hands.',
      'Ease down to a walk at the end rather than stopping dead.',
    ],
  },
  cycling: {
    demo: 'Bicycling_Stationary',
    steps: [
      'Set the saddle so your knee stays slightly bent at the bottom.',
      'Warm up for a few minutes at light resistance.',
      'Keep a smooth cadence rather than stamping the pedals.',
      'Stay seated with a relaxed grip and a neutral back.',
    ],
  },
  'rowing-machine': {
    demo: 'Rowing_Stationary',
    steps: [
      'Strap your feet in and start with your shins vertical.',
      'Drive with your legs first, then lean back, then pull with your arms.',
      'Reverse that order on the way back: arms, body, legs.',
      'Keep your back flat throughout — the legs do most of the work.',
    ],
  },
  elliptical: {
    demo: 'Elliptical_Trainer',
    steps: [
      'Step on and hold the moving handles.',
      'Start slow to find the rhythm before adding resistance.',
      'Stand tall and keep your whole foot on the pedal.',
      'Push and pull with your arms rather than just hanging on.',
    ],
  },
  'stair-climber': {
    demo: 'Stairmaster',
    steps: [
      'Start at a slow speed and step on before it builds up.',
      'Stand upright — don’t lean your weight onto the handrails.',
      'Take full steps rather than short bouncy ones.',
      'Rest a hand on the rail for balance only.',
    ],
  },
  'jump-rope': {
    demo: 'Rope_Jumping',
    steps: [
      'Size the rope so the handles reach your armpits when you stand on it.',
      'Keep your elbows close and turn the rope with your wrists.',
      'Jump just high enough to clear it — a couple of centimetres.',
      'Land softly on the balls of your feet.',
    ],
  },
  burpee: {
    demo: null,
    steps: [
      'Start standing, then squat down and place your hands on the floor.',
      'Jump or step your feet back into a push-up position.',
      'Do a push-up if you want the full version, then jump your feet back in.',
      'Stand and jump with your hands overhead.',
      'Land softly with soft knees before the next rep.',
    ],
  },
  'battle-ropes': {
    demo: 'Battling_Ropes',
    steps: [
      'Take an end in each hand and step back until there’s slight slack.',
      'Sit into a quarter-squat with your chest up.',
      'Drive alternating waves down the rope with your arms.',
      'Keep your core braced and breathe — work in short, hard intervals.',
    ],
  },
  'sled-push': {
    demo: 'Sled_Push',
    steps: [
      'Grip the uprights and lean into the sled with straight arms.',
      'Keep your back flat and your hips low.',
      'Drive with short, powerful steps rather than long strides.',
      'Push for the set distance, then rest fully before the next run.',
    ],
  },
}

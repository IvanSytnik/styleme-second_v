/**
 * SERVER-ONLY hairstyle prompts.
 *
 * Imported via the `@styleme/shared/hairstyles/prompts` subpath export.
 * Do NOT import from any browser-facing code — prompts are an IP asset
 * and must not ship in the client bundle.
 *
 * The web app should only ever import from `@styleme/shared` (root).
 */

export interface HairstylePrompt {
  readonly id: number;
  readonly prompt: string;
}

export const HAIRSTYLE_PROMPTS: ReadonlyMap<number, string> = new Map([
  // ===== FEMALE (1–20) =====
  [1,  'Change the hairstyle to a classic bob haircut, sleek and straight, chin length, clean edges. Keep the face exactly the same, only change the hair. Photorealistic.'],
  [2,  'Change the hairstyle to a long bob (lob) haircut, shoulder length, sleek and shiny, modern style. Keep the face exactly the same, only change the hair. Photorealistic.'],
  [3,  'Change the hairstyle to a pixie cut, very short and textured, modern edgy feminine look. Keep the face exactly the same, only change the hair. Photorealistic.'],
  [4,  'Change the hairstyle to glamorous hollywood waves, big soft curls, voluminous long hair, red carpet style. Keep the face exactly the same, only change the hair. Photorealistic.'],
  [5,  'Change the hairstyle to a layered cascade haircut, face-framing layers, voluminous and flowing. Keep the face exactly the same, only change the hair. Photorealistic.'],
  [6,  'Change the hairstyle to beach waves, relaxed wavy hair, natural tousled texture, effortless summer look. Keep the face exactly the same, only change the hair. Photorealistic.'],
  [7,  'Change the hairstyle to a shag haircut, heavily layered and textured, 70s rock style with modern touch, messy chic. Keep the face exactly the same, only change the hair. Photorealistic.'],
  [8,  'Change the hairstyle to long straight silky hair, smooth glossy shine, flowing down past shoulders. Keep the face exactly the same, only change the hair. Photorealistic.'],
  [9,  'Change the hairstyle to natural afro curls, voluminous bouncy curly hair, beautiful texture. Keep the face exactly the same, only change the hair. Photorealistic.'],
  [10, 'Change the hairstyle to a french braid, elegant single braid going down the back, neat and polished. Keep the face exactly the same, only change the hair. Photorealistic.'],
  [11, 'Change the hairstyle to a messy bun, relaxed updo on top of head, loose strands framing face, effortless chic. Keep the face exactly the same, only change the hair. Photorealistic.'],
  [12, 'Change the hairstyle to a sleek high ponytail, hair pulled back tightly, long flowing tail. Keep the face exactly the same, only change the hair. Photorealistic.'],
  [13, 'Change the hairstyle to boxer braids, two tight dutch braids going back, sporty athletic style. Keep the face exactly the same, only change the hair. Photorealistic.'],
  [14, 'Change the hairstyle to half-up half-down style, top section pulled back and secured, rest flowing down. Keep the face exactly the same, only change the hair. Photorealistic.'],
  [15, 'Change the hairstyle to a low elegant bun at the nape of neck, sophisticated and classy look. Keep the face exactly the same, only change the hair. Photorealistic.'],
  [16, 'Change the hairstyle to an asymmetrical bob, one side longer than the other, edgy modern cut. Keep the face exactly the same, only change the hair. Photorealistic.'],
  [17, 'Change the hairstyle to vintage finger waves, 1920s glamour style, sculpted S-shaped waves. Keep the face exactly the same, only change the hair. Photorealistic.'],
  [18, 'Change the hairstyle to add long curtain bangs, face-framing fringe parted in middle, with flowing hair. Keep the face exactly the same, only change the hair. Photorealistic.'],
  [19, 'Change the hairstyle to big voluminous curls, bouncy ringlets, lots of body and movement. Keep the face exactly the same, only change the hair. Photorealistic.'],
  [20, 'Change the hairstyle to a sleek low ponytail, perfectly smooth and polished, elegant minimalist style. Keep the face exactly the same, only change the hair. Photorealistic.'],

  // ===== MALE (21–40) =====
  [21, 'Change the hairstyle to a classic fade haircut, gradually shorter on sides, textured on top. Keep the face exactly the same, only change the hair. Photorealistic.'],
  [22, 'Change the hairstyle to an undercut, shaved sides with longer hair on top, modern disconnected style. Keep the face exactly the same, only change the hair. Photorealistic.'],
  [23, 'Change the hairstyle to a pompadour, volume swept up and back from forehead, classic rockabilly style. Keep the face exactly the same, only change the hair. Photorealistic.'],
  [24, 'Change the hairstyle to a textured crop, short textured top with fringe, faded sides. Keep the face exactly the same, only change the hair. Photorealistic.'],
  [25, 'Change the hairstyle to a quiff, volume at front swept upward and back, shorter sides. Keep the face exactly the same, only change the hair. Photorealistic.'],
  [26, 'Change the hairstyle to a buzz cut box style, very short all over, clean military look. Keep the face exactly the same, only change the hair. Photorealistic.'],
  [27, 'Change the hairstyle to a medium buzz cut, short sides with slightly longer top, neat and clean. Keep the face exactly the same, only change the hair. Photorealistic.'],
  [28, 'Change the hairstyle to a classic taper cut (canadka), longer on top gradually shorter to sides, professional look. Keep the face exactly the same, only change the hair. Photorealistic.'],
  [29, 'Change the hairstyle to a Caesar cut, short horizontal fringe, same length all around. Keep the face exactly the same, only change the hair. Photorealistic.'],
  [30, 'Change the hairstyle to a man bun, long hair tied up in bun on top/back of head. Keep the face exactly the same, only change the hair. Photorealistic.'],
  [31, 'Change the hairstyle to a textured messy style, choppy layers with movement, modern casual look. Keep the face exactly the same, only change the hair. Photorealistic.'],
  [32, 'Change the hairstyle to a buzz cut, very short clipper cut all over, minimal clean style. Keep the face exactly the same, only change the hair. Photorealistic.'],
  [33, 'Change the hairstyle to a spiky crew cut, short hair standing up like spikes, youthful edgy look. Keep the face exactly the same, only change the hair. Photorealistic.'],
  [34, 'Change the hairstyle to a British style cut, side part with volume, classic gentleman look. Keep the face exactly the same, only change the hair. Photorealistic.'],
  [35, 'Change the hairstyle to a grunge style, messy medium length hair, 90s rock aesthetic. Keep the face exactly the same, only change the hair. Photorealistic.'],
  [36, 'Change the hairstyle to a tennis haircut, short sides medium top, sporty clean look. Keep the face exactly the same, only change the hair. Photorealistic.'],
  [37, 'Change the hairstyle to a flat top, hair cut flat on top like a platform, retro military style. Keep the face exactly the same, only change the hair. Photorealistic.'],
  [38, 'Change the hairstyle to a fade with hair design, shaved pattern/lines on sides, artistic barber style. Keep the face exactly the same, only change the hair. Photorealistic.'],
  [39, 'Change the hairstyle to long flowing mens hair, past shoulders, natural and healthy looking. Keep the face exactly the same, only change the hair. Photorealistic.'],
  [40, 'Change the hairstyle to a classic side part, clean professional look, neatly combed to side. Keep the face exactly the same, only change the hair. Photorealistic.'],
]);

export function getPromptById(id: number): string | undefined {
  return HAIRSTYLE_PROMPTS.get(id);
}

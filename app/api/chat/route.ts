import { NextResponse } from "next/server";

const SYSTEM_PROMPT = `You are a helpful assistant for a donation platform called "Donation" that connects donors with recipients in Ethiopia.

ABOUT THE PLATFORM:
- Connects donors with verified recipients (individuals, NGOs, hospitals, schools, government offices)
- Supports both item donations (physical goods) and monetary donations (via Chapa)
- Recipients must verify their identity before they can receive donations
- Admin panel manages users, donations, campaigns, and reports

KEY FEATURES:
1. Donations: Users can post items they want to donate (Food, Clothing, Electronics, Books, Furniture, Other). Recipients can request items.
2. Campaigns: Fundraising drives for specific causes. Recipients create them with a goal amount. Donors contribute via Chapa.
3. Chapa Payment: Ethiopian payment gateway supporting CBE, Awash Bank, Dashen Bank, Telebirr, CBE Birr, and M-Pesa.
4. Requests: Recipients browse and request items from donors. Donors approve/reject requests.
5. Ratings: After a completed donation, users can rate each other (1-5 stars).
6. Reporting: Users can report inappropriate content, spam, fraud, etc.
7. Verification: Recipients upload ID images; admins approve them.

USER ROLES:
- Donor: Gives items or money
- Recipient: Requests and receives donations (must be verified)
- Admin: Manages the platform

TECHNICAL DETAILS:
- Built with Expo React Native (mobile app) and Next.js (admin web)
- Uses Supabase for database and storage
- Currency: ETB for all monetary transactions

Answer questions concisely, helpfully, and in a friendly tone. If asked about something outside the platform, politely redirect to the platform's features. Keep responses under 150 words.`;

const LANG_PROMPTS: Record<string, string> = {
  en: "Always respond in English.",
  am: "ሁልጊዜ በአማርኛ መልስ ስጥ። የተጠቃሚው ቋንቋ አማርኛ ነው።",
  om: "Yeroo hunda Afaan Oromootiin deebisi. Afaan fayyadamaa Afaan Oromoo dha.",
};

export async function POST(request: Request) {
  let lang = "en";
  try {
    const { message, language } = await request.json();
    lang = (language || "en") as string;
    const langInstruction = LANG_PROMPTS[lang] || LANG_PROMPTS.en;

    if (!message || typeof message !== "string") {
      return NextResponse.json(
        { success: false, response: "Please provide a message." },
        { status: 400 }
      );
    }

    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return NextResponse.json({
        success: true,
        response:
          "I'm running in offline mode. For AI-powered responses, add your GEMINI_API_KEY to the .env.local file.\n\nYou can get a free API key at https://aistudio.google.com/apikey (no credit card needed).",
      });
    }

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          system_instruction: {
            parts: [{ text: SYSTEM_PROMPT + "\n\n" + langInstruction }],
          },
          contents: [
            {
              role: "user",
              parts: [{ text: message }],
            },
          ],
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 300,
          },
        }),
      }
    );

    const data = await response.json();

    if (!response.ok) {
      console.error("[chat] Gemini error:", data);
      const fallbackMsgs: Record<string, string> = {
        en: "offline mode - The AI service is currently unavailable (quota exceeded).",
        am: "ከመስመር ውጭ ሁነታ - የAI አገልግሎት በአሁኑ ጊዜ አይገኝም።",
        om: "haala offline - Tajaajilli AI yeroo ammaa hin jiru.",
      };
      return NextResponse.json(
        {
          success: true,
          response: fallbackMsgs[lang] || fallbackMsgs.en,
        },
        { status: 200 }
      );
    }

    const text =
      data?.candidates?.[0]?.content?.parts?.[0]?.text ||
      "Sorry, I couldn't generate a response.";

    return NextResponse.json({ success: true, response: text });
  } catch (error) {
    console.error("[chat] Error:", error);
    const errorMsgs: Record<string, string> = {
      en: "offline mode - Something went wrong on my end. Please try again later.",
      am: "ከመስመር ውጭ ሁነታ - በእኔ በኩል ስህተት ተከስቷል። እባክዎ በኋላ እንደገና ይሞክሩ።",
      om: "haala offline - Dogoggorri karaa koo irratti ta'e. Mee booda deebi'ii yaali.",
    };
    return NextResponse.json(
      {
        success: true,
        response: errorMsgs[lang] || errorMsgs.en,
      },
      { status: 200 }
    );
  }
}

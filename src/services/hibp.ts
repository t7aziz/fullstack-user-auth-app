import axios from 'axios';

export async function checkPasswordBreached(sha1: string) {
    const prefix = sha1.slice(0, 5).toUpperCase();
    const suffix = sha1.slice(5).toUpperCase();
    const url = `https://api.pwnedpasswords.com/range/${prefix}`;

    try {
        const res = await axios.get<string>(url, {
            headers: {
                'User-Agent': 'my-express-app',
                'Add-Padding': 'true'
            },
            responseType: 'text'
        });

        const lines = res.data.split(/\r?\n/);
        const match = lines.find(line => line.startsWith(suffix));
        //console.log(`lines: ${lines}, match: ${match}`);
        if (!match) {
            console.log("Breached: false, count: 0");
            return { breached: false, count: 0 };
        }

        const parts = match.split(':');
        const count = Number(parts[1]) || 0;

        console.log(`Breached: true, count: ${count}`);
        return { breached: true, count };
    } catch (err) {
        console.error('HIBP API error:', err);
        // bubble a clear error for callers to handle
        throw new Error('Failed to check password breach status');
    }
}
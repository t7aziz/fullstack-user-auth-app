import axios from 'axios';

const HIBP_API = 'https://api.pwnedpasswords.com/range/';

export async function checkPasswordBreached(passwordHash: string): Promise<{ breached: boolean; count: number }> {
    try {
        const prefix = passwordHash.substring(0, 5);
        const suffix = passwordHash.substring(5);
        
        // Query HIBP API
        const response = await axios.get(`${HIBP_API}${prefix}`, {
            headers: {
                'User Agent': 'YourApp-PasswordChecker',
                'Add-Padding': 'true'
            }
        });

        const hashes = response.data.split('\n');

        for (const line of hashes) {
            const [hashSuffix, count] = line.split(':');
            if (hashSuffix.trim().toUpperCase() === suffix.toUpperCase()) {
                return {
                    breached: true,
                    count: parseInt(count.trim(), 10)
                }
            }
        }

        return {breached: false, count: 0};
    } catch (error) {
        console.error('HIBP API error:', error);
        throw new Error('Failed to check password breach status');
    }
}
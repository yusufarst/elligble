// Password policy (DEC-022, DEC-041): at least 8 characters, at least 64 supported, no
// composition rules, and commonly used or trivially guessable passwords are rejected with a
// local blocklist (DEC-041 allows a securely maintained local list; no provider is used).

export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 128;

export type PasswordRejection = 'too_short' | 'too_long' | 'too_common' | 'contains_username';

// Lower-cased. Common global passwords plus common Indonesian and school-context choices.
const BLOCKLIST = new Set([
    '12345678', '123456789', '1234567890', '12345678910', '0123456789', '87654321', '98765432', '11223344',
    '12341234', '123123123', '123321123', '1q2w3e4r', '1q2w3e4r5t', 'q1w2e3r4', 'qwerty12', 'qwerty123',
    'qwertyui', 'qwertyuiop', 'asdfghjk', 'asdfghjkl', 'zxcvbnm1', 'zxcvbnm123', 'qazwsxedc', '1qaz2wsx',
    'password', 'password1', 'password12', 'password123', 'passw0rd', 'p@ssw0rd', 'p@ssword', 'pass1234',
    'abcd1234', 'abc12345', 'abcdefgh', 'abcdefg1', 'aa123456', 'a1234567', 'iloveyou', 'iloveyou1',
    'sunshine', 'princess', 'football', 'baseball', 'superman', 'batman12', 'welcome1', 'welcome123',
    'letmein1', 'monkey12', 'dragon12', 'trustno1', 'whatever', 'computer', 'internet', 'starwars',
    'admin123', 'administrator', 'rootroot', 'changeme', 'default1', 'secret12', 'test1234', 'testtest',
    'katasandi', 'kata sandi', 'katasandi1', 'katasandi123', 'rahasia1', 'rahasia123', 'sandi123',
    'bismillah', 'bismillah1', 'bismillah123', 'alhamdulillah', 'indonesia', 'indonesia1', 'indonesia123',
    'jakarta1', 'jakarta123', 'bandung123', 'surabaya1', 'merdeka45', 'merdeka1945', 'garuda123',
    'sayang123', 'sayangku', 'cintaku1', 'aku12345', 'akusayangkamu', 'kamu1234', 'rindu123',
    'sekolah1', 'sekolah123', 'siswa123', 'siswa1234', 'murid123', 'guru1234', 'guru12345', 'kelas123',
    'ujian123', 'ujian1234', 'belajar1', 'belajar123', 'pelajar1', 'pintar123', 'juara123', 'elligble',
    'elligble1', 'elligble123', 'mahasiswa', 'smansa123', 'smanegeri', 'nisn1234', 'tanggallahir',
    '11111111', '00000000', '22222222', '33333333', '44444444', '55555555', '66666666', '77777777',
    '88888888', '99999999', '10101010', '12121212', '13131313', '69696969', '01010101', '20202020',
]);

function isSingleRepeatedCharacter(chars: string[]): boolean {
    return chars.every(ch => ch === chars[0]);
}

function isSimpleSequence(chars: string[]): boolean {
    const codes = chars.map(ch => ch.codePointAt(0) ?? 0);
    const step = codes[1] - codes[0];
    if (step !== 1 && step !== -1) return false;
    return codes.every((code, i) => i === 0 || code - codes[i - 1] === step);
}

/** Returns why a new password is refused, or null when it is acceptable. */
export function checkNewPassword(password: unknown, context: { username?: string | null } = {}): PasswordRejection | null {
    if (typeof password !== 'string') return 'too_short';
    const chars = [...password];
    if (chars.length < PASSWORD_MIN_LENGTH) return 'too_short';
    if (chars.length > PASSWORD_MAX_LENGTH) return 'too_long';
    const lowered = password.toLowerCase();
    if (BLOCKLIST.has(lowered) || BLOCKLIST.has(lowered.trim()) || isSingleRepeatedCharacter(chars) || isSimpleSequence(chars)) {
        return 'too_common';
    }
    const username = context.username?.trim().toLowerCase();
    if (username && username.length >= 4 && lowered.includes(username)) return 'contains_username';
    return null;
}

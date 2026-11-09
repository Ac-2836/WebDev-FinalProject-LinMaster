import jwt, {SignOptions} from 'jsonwebtoken';

const TOKEN_LIFETIME: SignOptions['expiresIn'] = '1h';

export interface AuthTokenPayload {
  userId: string;
}

export function signJwt(userId: string, secret: string): string {
  return jwt.sign({}, secret, {
    algorithm: 'HS256',
    subject: userId,
    expiresIn: TOKEN_LIFETIME,
  });
}

export function verifyJwt(token: string, secret: string): AuthTokenPayload {
  const payload = jwt.verify(token, secret, {algorithms: ['HS256']});

  if (typeof payload === 'string' || typeof payload.sub !== 'string' || !payload.sub) {
    throw new jwt.JsonWebTokenError('Token subject is missing.');
  }

  return {userId: payload.sub};
}

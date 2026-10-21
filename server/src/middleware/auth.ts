import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';

declare global {
  namespace Express {
    interface Request {
      auth?: { userId: string };
    }
  }
}

export function requireAuth(secret: string) {
  return (request: Request, response: Response, next: NextFunction): void => {
    const authorization = request.header('authorization');
    const [scheme, token] = authorization?.split(' ') ?? [];
    if (scheme?.toLowerCase() !== 'bearer' || !token) {
      response.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Authentication is required' } });
      return;
    }

    try {
      const payload = jwt.verify(token, secret);
      if (typeof payload === 'string' || typeof payload.sub !== 'string') throw new Error('Invalid token subject');
      request.auth = { userId: payload.sub };
      next();
    } catch {
      response.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'The access token is invalid or expired' } });
    }
  };
}
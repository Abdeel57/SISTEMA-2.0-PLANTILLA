import type { FastifyError, FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { ZodError } from 'zod';
import { Prisma } from '@prisma/client';
import { AppError } from '../lib/errors.js';
import { captureError } from '../lib/sentry.js';

export function registerErrorHandler(app: FastifyInstance): void {
  app.setErrorHandler((error: FastifyError, request: FastifyRequest, reply: FastifyReply) => {
    // Errores de dominio
    if (error instanceof AppError) {
      reply.code(error.statusCode).send({
        error: error.code,
        message: error.message,
        details: error.details,
      });
      return;
    }

    // Validación Zod directa
    if (error instanceof ZodError) {
      reply.code(400).send({
        error: 'bad_request',
        message: 'Datos inválidos',
        details: error.flatten(),
      });
      return;
    }

    // Prisma: violación de unicidad
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2002') {
        const target = (error.meta?.target as string[] | undefined)?.join(', ');
        reply.code(409).send({
          error: 'conflict',
          message: `Ya existe un registro con ese valor${target ? ` (${target})` : ''}.`,
        });
        return;
      }
      if (error.code === 'P2025') {
        reply.code(404).send({ error: 'not_found', message: 'Registro no encontrado' });
        return;
      }
    }

    // Rate limit de @fastify/rate-limit
    if ((error as { statusCode?: number }).statusCode === 429) {
      reply.code(429).send({ error: 'too_many_requests', message: 'Demasiadas solicitudes, intenta más tarde.' });
      return;
    }

    // Validación de esquema de Fastify
    if (error.validation) {
      reply.code(400).send({ error: 'bad_request', message: error.message, details: error.validation });
      return;
    }

    // Desconocido
    request.log.error({ err: error }, 'Error no controlado');
    captureError(error); // reporta a Sentry (no-op sin DSN)
    const statusCode = error.statusCode && error.statusCode >= 400 ? error.statusCode : 500;
    reply.code(statusCode).send({
      error: 'internal_error',
      message: statusCode === 500 ? 'Error interno del servidor' : error.message,
    });
  });

  // El 404 se define en app.ts: ahí decide entre el JSON de la API y el
  // fallback del SPA (index.html) cuando este proceso sirve el frontend.
}

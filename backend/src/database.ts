import { PrismaClient } from '@prisma/client'

/**
 * Singleton PrismaClient instance.
 * Follows Prisma best practice of a single client per application.
 */
export const prisma = new PrismaClient()

/**
 * Connect to the database and log success.
 * Should be called on application startup.
 */
export async function connectDatabase(): Promise<void> {
  await prisma.$connect()
  console.log('Database connected successfully')
}

/**
 * Disconnect from the database gracefully.
 * Should be called on application shutdown.
 */
export async function disconnectDatabase(): Promise<void> {
  await prisma.$disconnect()
  console.log('Database disconnected')
}
import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
    const users = await prisma.user.findMany()
    console.log("Users in DB:")
    users.forEach(u => {
        console.log(`- ${u.id}: ${u.firstName} ${u.lastName} (${u.email})`)
    })

    const topics = await prisma.conversationTopic.findMany()
    console.log("\nTopics in DB:")
    topics.forEach(t => {
        console.log(`- ${t.id} (User: ${t.userId}): ${t.title}`)
    })
}

main().catch(console.error).finally(() => prisma.$disconnect())

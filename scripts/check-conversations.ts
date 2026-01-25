import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
    const userId = "696b3d8421d0c08978ed268b"

    const topics = await prisma.conversationTopic.findMany({
        where: { userId },
        include: {
            conversations: {
                orderBy: { createdAt: "desc" },
            },
        },
    })

    console.log(`User ${userId} has ${topics.length} topics`)

    topics.forEach(topic => {
        console.log(`\nTopic: ${topic.title} (ID: ${topic.id})`)
        console.log(`  Has ${topic.conversations.length} conversations:`)
        topic.conversations.forEach((conv, idx) => {
            console.log(`  ${idx + 1}. [${conv.id}] VN: "${conv.vietnameseText}" => EN: "${conv.englishText}"`)
        })
    })
}

main().catch(console.error).finally(() => prisma.$disconnect())

import { prisma } from "@/lib/database";
import { communityDb } from "@/lib/community-db";
import { getAuthEmail } from "@/lib/auth";
import { SuccessResponse, ErrorResponse } from "@/lib/api-response";
import { NextRequest } from "next/server";

/**
 * PATCH /api/profile/location
 * Update the player's location (state, district, town).
 * Auto-creates new CentralLocationState/District/Town entries in central DB.
 * Updates the player's string fields in the game-specific DB.
 */
export async function PATCH(req: NextRequest) {
    try {
        const email = await getAuthEmail();
        if (!email) {
            return ErrorResponse({ message: "Unauthorized", status: 401 });
        }

        const body = await req.json();
        const { state, district, town } = body as {
            state?: string;
            district?: string;
            town?: string;
        };

        const trimmedState = state?.trim();
        const trimmedDistrict = district?.trim();
        const trimmedTown = town?.trim();

        if (!trimmedState || !trimmedDistrict || !trimmedTown) {
            return ErrorResponse({
                message: "State, district, and town are all required",
                status: 400,
            });
        }

        // Find the player in game DB
        const user = await prisma.user.findFirst({
            where: {
                OR: [{ email }, { secondaryEmail: email }],
            },
            select: { player: { select: { id: true } } },
        });

        if (!user?.player) {
            return ErrorResponse({ message: "Player not found", status: 404 });
        }

        // Upsert state → district → town in CENTRAL location tables
        const locationState = await communityDb.centralLocationState.upsert({
            where: { name: trimmedState },
            update: {},
            create: { name: trimmedState },
        });

        const locationDistrict = await communityDb.centralLocationDistrict.upsert({
            where: {
                name_stateId: { name: trimmedDistrict, stateId: locationState.id },
            },
            update: {},
            create: { name: trimmedDistrict, stateId: locationState.id },
        });

        // Check if this town already exists under a DIFFERENT district in the same state
        // (prevents misplaced towns, e.g. "Mairang" under "East Khasi Hills" when it belongs to "Eastern West Khasi Hills")
        const existingTown = await communityDb.centralLocationTown.findFirst({
            where: {
                name: { equals: trimmedTown, mode: "insensitive" },
                districtId: { not: locationDistrict.id },
                district: { stateId: locationState.id },
            },
            include: { district: { select: { name: true } } },
        });

        if (existingTown) {
            return ErrorResponse({
                message: `${trimmedTown} already exists under ${existingTown.district.name}. Please select the correct district.`,
                status: 400,
            });
        }

        await communityDb.centralLocationTown.upsert({
            where: {
                name_districtId: { name: trimmedTown, districtId: locationDistrict.id },
            },
            update: {},
            create: { name: trimmedTown, districtId: locationDistrict.id },
        });

        // Update player's location strings in game-specific DB
        await prisma.player.update({
            where: { id: user.player.id },
            data: {
                state: trimmedState,
                district: trimmedDistrict,
                town: trimmedTown,
            },
        });

        return SuccessResponse({ message: "Location updated" });
    } catch (error) {
        return ErrorResponse({ message: "Failed to update location", error });
    }
}

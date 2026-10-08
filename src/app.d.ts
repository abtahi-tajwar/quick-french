declare global {
	namespace App {
		interface Locals {
			user: { id: string; username: string } | null;
			configured: boolean;
			dbError: string | null;
		}
	}
}

export {};

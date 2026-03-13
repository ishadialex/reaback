import { Router } from "express";
import { adminAuthFlexible } from "../../middleware/adminAuthFlexible.js";
import { importFromZillow } from "../../controllers/admin/zillow.controller.js";

const router = Router();

router.use(adminAuthFlexible);

router.post("/import", importFromZillow);

export default router;
